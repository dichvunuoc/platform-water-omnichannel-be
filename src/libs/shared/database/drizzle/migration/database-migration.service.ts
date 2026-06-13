import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as path from 'path';

/**
 * Database Migration Service
 *
 * Automatically runs pending Drizzle migrations on application startup.
 * This ensures the database schema is always up-to-date before the app
 * starts serving requests — critical for production deployments.
 *
 * Behavior:
 * - Runs on every app startup (OnModuleInit)
 * - Only applies pending migrations (idempotent)
 * - Logs each migration step for audit trail
 * - Fails fast if migration fails (app won't start with broken schema)
 *
 * Migration files are located in: /drizzle directory (project root).
 */
@Injectable()
export class DatabaseMigrationService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseMigrationService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.runMigrations();
  }

  /**
   * Run pending database migrations using Drizzle's built-in migrator.
   *
   * Creates a temporary connection to the database, runs migrations,
   * then closes the connection. This is separate from the app's
   * connection pool to avoid interference.
   */
  private async runMigrations(): Promise<void> {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }

    const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

    this.logger.log(`Running database migrations from: ${migrationsFolder}`);

    const pool = new Pool({
      connectionString,
      min: 1,
      max: 1,
      connectionTimeoutMillis: 10000,
    });

    try {
      const db = drizzle(pool);

      await migrate(db, { migrationsFolder });

      this.logger.log('Database migrations completed successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Database migration failed: ${errorMessage}`,
        errorStack,
      );
      throw error; // Fail fast — app shouldn't start with broken schema
    } finally {
      await pool.end();
    }
  }
}
