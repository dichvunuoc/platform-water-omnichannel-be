import { Module, Global, OnModuleInit } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DatabaseHealthIndicator } from './indicators/database.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { PortHealthIndicator } from '../port/port-health-indicator';
import { PortModule } from '../port/port.module';

/**
 * Health Check Module
 * Provides health check endpoints and indicators
 */
@Global()
@Module({
  imports: [PortModule],
  controllers: [HealthController],
  providers: [HealthService, DatabaseHealthIndicator, RedisHealthIndicator, PortHealthIndicator],
  exports: [HealthService, DatabaseHealthIndicator, RedisHealthIndicator, PortHealthIndicator],
})
export class HealthModule implements OnModuleInit {
  constructor(
    private readonly healthService: HealthService,
    private readonly databaseIndicator: DatabaseHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly portIndicator: PortHealthIndicator,
  ) {}

  onModuleInit() {
    this.healthService.registerIndicator('database', this.databaseIndicator);
    this.healthService.registerIndicator('redis', this.redisIndicator);
    this.healthService.registerIndicator('ports', this.portIndicator);
  }
}
