import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: [
    './src/modules/**/infrastructure/persistence/drizzle/schema/*.ts',
    './src/libs/shared/database/outbox/drizzle/schema/outbox.schema.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'nestjs_project',
    ssl: false,
  },
});
