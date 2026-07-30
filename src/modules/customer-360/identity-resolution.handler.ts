/**
 * IdentityResolutionHandler (Phase 3 Step 1 — Customer 360).
 *
 * Event-driven: subscribe ConversationStarted → resolve identity → link customer.
 * Hoàn toàn decoupled (giống ConversationStartedTicketHandler pattern Phase 2).
 *
 * Flow:
 *   ConversationStarted event
 *     → ICustomer360Port.resolveIdentity(channel, customerChannelId)
 *     → Nếu tìm thấy → AssignCustomerCommand (link conversation.customerId)
 *     → Nếu không tìm thấy → log + agent link thủ công sau (FR30 fallback)
 */
import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import type { ICommandBus } from 'src/libs/core/application';
import { COMMAND_BUS_TOKEN } from 'src/libs/core/constants';
import type { IEventBus } from 'src/libs/core/infrastructure';
import { EVENT_BUS_TOKEN } from 'src/libs/core/constants';
import type { ICustomer360Port, CustomerProfile } from './customer-360.port';
import { CUSTOMER_360_PORT_TOKEN } from './customer-360.tokens';
import { AssignCustomerCommand } from '../messaging/application/commands/assign-customer.command';

@Injectable()
export class IdentityResolutionHandler implements OnModuleInit {
  private readonly logger = new Logger('IdentityResolutionHandler');

  constructor(
    @Inject(EVENT_BUS_TOKEN) private readonly eventBus: IEventBus,
    @Inject(CUSTOMER_360_PORT_TOKEN) private readonly customer360: ICustomer360Port,
    @Inject(COMMAND_BUS_TOKEN) private readonly commandBus: ICommandBus,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(
      'ConversationStarted',
      async (event: any) => {
        await this.handleResolution(event).catch((e) =>
          this.logger.error(`Identity resolution failed: ${e.message}`),
        );
      },
      { queueName: 'ConversationStarted.identity-resolution', durable: true },
    );
  }

  private async handleResolution(event: any): Promise<void> {
    const data = event.data ?? event;
    const conversationId = data.conversationId ?? event.aggregateId;
    const customerChannelId = data.customerChannelId ?? 'unknown';
    const channel = data.channel ?? 'APP';

    this.logger.log(
      `Resolving identity: conv=${conversationId} channel=${channel} ccid=${customerChannelId}`,
    );

    const profile = await this.customer360.resolveIdentity(channel, customerChannelId);

    if (profile) {
      // FR31 — link resolved customerId to conversation
      await this.commandBus.execute(
        new AssignCustomerCommand(conversationId, profile.id),
      );
      this.logger.log(
        `Identity resolved: conv=${conversationId} → customer=${profile.id} (${profile.name})`,
      );
    } else {
      // FR30 — unresolved, agent links manually later
      this.logger.warn(
        `Identity unresolved: conv=${conversationId} ccid=${customerChannelId} — agent will link manually`,
      );
    }
  }
}
