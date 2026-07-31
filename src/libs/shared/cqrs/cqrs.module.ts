import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { NestCommandBus } from './buses/nest-command-bus';
import { NestQueryBus } from './buses/nest-query-bus';
import { EventBus } from './events/event-bus';
import { AmqpConnection } from './events/amqp-connection';
import { AmqpEventBus } from './events/amqp-event-bus';
import { IdempotencyService } from './idempotency/idempotency.service';

import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN, EVENT_BUS_TOKEN } from '@core';

export { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN, EVENT_BUS_TOKEN };

/**
 * CQRS Module — Global.
 *
 * EVENT_BUS_TOKEN provider: factory selects AmqpEventBus when AMQP_URL is set,
 * otherwise falls back to in-process EventBus (dev/test without RabbitMQ).
 */
@Global()
@Module({
  imports: [CqrsModule, ConfigModule],
  providers: [
    NestCommandBus,
    NestQueryBus,
    EventBus,
    AmqpConnection,
    AmqpEventBus,
    IdempotencyService,
    {
      provide: 'AMQP_CONNECTION',
      useExisting: AmqpConnection,
    },
    {
      provide: COMMAND_BUS_TOKEN,
      useExisting: NestCommandBus,
    },
    {
      provide: QUERY_BUS_TOKEN,
      useExisting: NestQueryBus,
    },
    {
      provide: EVENT_BUS_TOKEN,
      useFactory: (config: ConfigService, amqpBus: AmqpEventBus, inProcessBus: EventBus) => {
        return config.get<string>('AMQP_URL') ? amqpBus : inProcessBus;
      },
      inject: [ConfigService, AmqpEventBus, EventBus],
    },
  ],
  exports: [
    CqrsModule,
    NestCommandBus,
    NestQueryBus,
    EventBus,
    AmqpConnection,
    AmqpEventBus,
    IdempotencyService,
    COMMAND_BUS_TOKEN,
    QUERY_BUS_TOKEN,
    EVENT_BUS_TOKEN,
    'AMQP_CONNECTION',
  ],
})
export class SharedCqrsModule {}
