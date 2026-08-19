/**
 * AMQP Connection Manager
 *
 * Manages a single amqplib connection + confirm channel to RabbitMQ.
 * Handles reconnect, topology setup (exchange), and provides the channel
 * for AmqpEventBus to publish/consume.
 *
 * Lifecycle: connect() on module init, close() on destroy.
 * If AMQP_URL is unset, connect() returns null (caller falls back to in-process bus).
 */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import type { ConfirmChannel } from 'amqplib';

export const EXCHANGE_NAME = 'water-platform';

@Injectable()
export class AmqpConnection implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AmqpConnection');
  private connection: any = null;
  private channel: ConfirmChannel | null = null;
  private readonly url: string | undefined;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: ConfigService) {
    this.url = this.config.get<string>('AMQP_URL') || undefined;
  }

  async onModuleInit(): Promise<void> {
    if (!this.url) {
      this.logger.log(
        'AMQP_URL not set — AmqpConnection idle (in-process fallback)',
      );
      return;
    }
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // ignore — shutting down
    }
  }

  getChannel(): ConfirmChannel | null {
    return this.channel;
  }

  isReady(): boolean {
    return this.channel !== null;
  }

  private async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url!);
      this.channel = await this.connection.createConfirmChannel();

      // Assert the topic exchange (durable, survives restart).
      await this.channel!.assertExchange(EXCHANGE_NAME, 'topic', {
        durable: true,
      });
      await this.channel!.prefetch(1);

      this.logger.log(
        `Connected to RabbitMQ, exchange '${EXCHANGE_NAME}' asserted`,
      );

      // Reconnect on close.
      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed — will retry in 5s');
        this.channel = null;
        this.connection = null;
        this.scheduleReconnect();
      });
      this.connection.on('error', (err: Error) => {
        this.logger.error(`RabbitMQ connection error: ${err.message}`);
      });
    } catch (err) {
      this.logger.error(
        `Failed to connect to RabbitMQ: ${(err as Error).message}`,
      );
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      // void-wrapper: setTimeout callback phải trả void (no-misused-promises) —
      // fire-and-forget reconnect, lỗi được logger xử lý bên trong connect().
      void (async () => {
        this.reconnectTimer = null;
        if (this.url) await this.connect();
      })();
    }, 5000);
  }
}
