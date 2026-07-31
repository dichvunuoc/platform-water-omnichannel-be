/**
 * AMQP (RabbitMQ) Health Indicator — checks connection via AmqpConnection channel.
 * Reports DOWN if channel not ready (RabbitMQ unavailable or disconnected).
 */
import { Injectable, Optional, Inject } from '@nestjs/common';
import type { IHealthIndicator, HealthCheckResult } from '../health.interface';
import { HealthStatus } from '../health.interface';

export const AMQP_CONNECTION_TOKEN = 'AMQP_CONNECTION';

export interface IAmqpConnection {
  isReady(): boolean;
  getChannel(): { close(): Promise<void> } | null;
}

@Injectable()
export class AmqpHealthIndicator implements IHealthIndicator {
  constructor(
    @Optional()
    @Inject(AMQP_CONNECTION_TOKEN)
    private readonly amqp?: IAmqpConnection,
  ) {}

  async check(): Promise<HealthCheckResult> {
    if (!this.amqp) {
      return {
        status: HealthStatus.DEGRADED,
        message: 'AMQP connection not configured (in-process bus)',
        timestamp: new Date().toISOString(),
      };
    }

    const ready = this.amqp.isReady();
    return {
      status: ready ? HealthStatus.UP : HealthStatus.DOWN,
      message: ready ? 'RabbitMQ connected' : 'RabbitMQ channel not ready',
      timestamp: new Date().toISOString(),
    };
  }
}
