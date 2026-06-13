import { Injectable, Logger, Optional } from '@nestjs/common';
import type { IHealthIndicator, HealthCheckResult } from '../health.interface';
import { HealthStatus } from '../health.interface';
import { DatabaseService } from '../../database/drizzle/database.service';

/**
 * Database Health Indicator
 * Checks PostgreSQL database connection health via DatabaseService.
 * Uses the WRITE pool for health checks.
 */
@Injectable()
export class DatabaseHealthIndicator implements IHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(
    @Optional()
    private readonly databaseService?: DatabaseService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    if (!this.databaseService) {
      return {
        status: HealthStatus.DEGRADED,
        message: 'Database service is not configured',
        timestamp: new Date().toISOString(),
      };
    }

    const startTime = Date.now();

    try {
      const isHealthy = await this.databaseService.checkConnection('WRITE');
      const responseTime = Date.now() - startTime;

      if (isHealthy) {
        const stats = this.databaseService.getPoolStats('WRITE');
        return {
          status: HealthStatus.UP,
          message: 'Database connection is healthy',
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          ...(stats ? {
            pool: {
              total: stats.totalCount,
              idle: stats.idleCount,
              waiting: stats.waitingCount,
            },
          } : {}),
        };
      }

      return {
        status: HealthStatus.DOWN,
        message: 'Database connection health check failed',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error(
        `Database health check failed: ${(error as Error).message}`,
      );

      return {
        status: HealthStatus.DOWN,
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
