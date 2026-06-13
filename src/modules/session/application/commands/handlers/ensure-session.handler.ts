import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { EnsureSessionCommand } from '../ensure-session.command';
import { SESSION_STORE_TOKEN } from '../../../constants/tokens';
import type { ISessionStore } from '../../../domain/repositories/session-store.interface';
import { randomUUID } from 'crypto';

@CommandHandler(EnsureSessionCommand)
export class EnsureSessionHandler implements ICommandHandler<EnsureSessionCommand> {
  private readonly logger = new Logger(EnsureSessionHandler.name);

  constructor(
    @Inject(SESSION_STORE_TOKEN) private readonly sessionStore: ISessionStore,
  ) {}

  async execute(command: EnsureSessionCommand): Promise<void> {
    const { userId, channel } = command;

    try {
      const exists = await this.sessionStore.sessionExists(userId);

      if (!exists) {
        // Create new session with session_started event
        await this.sessionStore.appendEvent(userId, {
          id: randomUUID(),
          type: 'session_started',
          channel,
          timestamp: new Date().toISOString(),
          content: { channel },
        });
        this.logger.log(`New session created for ${userId} on ${channel}`);
        return;
      }

      // Session exists — check if channel changed
      const metadata = await this.sessionStore.getSession(userId);
      if (metadata && metadata.channel !== channel) {
        // Channel switch — record continuation event
        await this.sessionStore.appendEvent(userId, {
          id: randomUUID(),
          type: 'session_continued',
          channel,
          timestamp: new Date().toISOString(),
          content: { fromChannel: metadata.channel, toChannel: channel },
        });
        this.logger.log(`Session continued for ${userId}: ${metadata.channel} → ${channel}`);
      }
    } catch (error) {
      // Session ensure failure should NOT break the caller
      // Log and continue — the read query can still serve stale data
      this.logger.error(
        `Failed to ensure session for ${userId}: ${(error as Error).message}`,
      );
    }
  }
}
