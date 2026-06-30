import { Inject, Logger } from '@nestjs/common';
import type { ICommandHandler } from 'src/libs/core/application';
import { NotFoundException } from 'src/libs/core/common';
import { CommandHandler } from 'src/libs/shared/cqrs';
import type { IConversationRepository } from '../../../domain';
import type { IFieldTeamPort, WorkOrderResult } from '../../../domain/ports/field-team.port';
import { CONVERSATION_REPOSITORY_TOKEN } from '../../../constants/tokens';
import { FIELD_TEAM_PORT_TOKEN } from '../../../constants/field-team-tokens';
import { DispatchWorkOrderCommand } from '../dispatch-work-order.command';

/**
 * Dispatch Work Order Command Handler (FR62 — Epic 7).
 *
 * Flow:
 *  1. Load conversation (must exist).
 *  2. Call Field Team port → dispatch Work Order.
 *  3. Return result (workOrderId, crewId, ETA).
 *
 * This is the J1 demo closing step: "chuyển đội hiện trường".
 */
@CommandHandler(DispatchWorkOrderCommand)
export class DispatchWorkOrderHandler
  implements ICommandHandler<DispatchWorkOrderCommand, WorkOrderResult>
{
  private readonly logger = new Logger(DispatchWorkOrderHandler.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY_TOKEN)
    private readonly conversationRepository: IConversationRepository,
    @Inject(FIELD_TEAM_PORT_TOKEN)
    private readonly fieldTeam: IFieldTeamPort,
  ) {}

  async execute(command: DispatchWorkOrderCommand): Promise<WorkOrderResult> {
    // 1. Validate conversation exists
    const conversation = await this.conversationRepository.getById(command.conversationId);
    if (!conversation) {
      throw NotFoundException.entity('Conversation', command.conversationId);
    }

    // 2. Dispatch to Field-team App (mock → real in wave-3)
    const result = await this.fieldTeam.dispatchWorkOrder({
      incidentType: command.incidentType,
      priority: command.priority,
      address: command.address,
      photoUrls: command.photoUrls,
      conversationId: command.conversationId,
      customerId: command.customerId,
    });

    if (!result.success) {
      this.logger.error(
        `Work Order dispatch FAILED: conv=${command.conversationId} err=${result.error}`,
      );
      return result;
    }

    this.logger.log(
      `Work Order dispatched: WO=${result.workOrderId} crew=${result.crewId} ETA=${result.estimatedArrivalMin}min`,
    );

    return result;
  }
}
