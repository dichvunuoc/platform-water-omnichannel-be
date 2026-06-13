import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { RecordSessionEventCommand } from '../record-session-event.command';
import { SESSION_STORE_TOKEN } from '../../../constants/tokens';
import type { ISessionStore } from '../../../domain/repositories/session-store.interface';
import type { SessionEvent } from '../../dtos/session-event.dto';
import { RecordSessionEventPayloadSchema } from '../../dtos/session-event.dto';
import { randomUUID } from 'crypto';

@CommandHandler(RecordSessionEventCommand)
export class RecordSessionEventHandler
  implements ICommandHandler<RecordSessionEventCommand>
{
  private readonly logger = new Logger(RecordSessionEventHandler.name);

  constructor(
    @Inject(SESSION_STORE_TOKEN) private readonly sessionStore: ISessionStore,
  ) {}

  async execute(command: RecordSessionEventCommand): Promise<void> {
    const { userId, eventType, channel, content } = command.payload;

    // Validate payload with Zod — rejects invalid event types / channels
    const parsed = RecordSessionEventPayloadSchema.safeParse(command.payload);
    if (!parsed.success) {
      this.logger.warn(
        `Invalid session event payload: ${parsed.error.message}`,
      );
      return;
    }

    const event: SessionEvent = {
      id: randomUUID(),
      type: eventType,
      channel,
      timestamp: new Date().toISOString(),
      content,
    };

    try {
      await this.sessionStore.appendEvent(userId, event);
      this.logger.log(
        `Session event recorded: ${eventType} for ${userId}`,
      );
    } catch (error) {
      // Session event recording failure should NOT break the caller
      // Log and continue — the interaction itself must still succeed
      this.logger.error(
        `Failed to record session event: ${eventType} for ${userId}`,
        error,
      );
    }
  }
}
