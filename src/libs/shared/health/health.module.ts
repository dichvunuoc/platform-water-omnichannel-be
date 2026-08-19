import { Module, Global, OnModuleInit } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DatabaseHealthIndicator } from './indicators/database.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import {
  AmqpHealthIndicator,
  AMQP_CONNECTION_TOKEN,
} from './indicators/amqp.health-indicator';

/**
 * Health Check Module
 * Provides health check endpoints and indicators for PG, Redis, RabbitMQ
 */
@Global()
@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    DatabaseHealthIndicator,
    RedisHealthIndicator,
    AmqpHealthIndicator,
  ],
  exports: [HealthService],
})
export class HealthModule implements OnModuleInit {
  constructor(
    private readonly healthService: HealthService,
    private readonly databaseIndicator: DatabaseHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly amqpIndicator: AmqpHealthIndicator,
  ) {}

  onModuleInit() {
    this.healthService.registerIndicator('database', this.databaseIndicator);
    this.healthService.registerIndicator('redis', this.redisIndicator);
    this.healthService.registerIndicator('amqp', this.amqpIndicator);
  }
}
