import { Injectable, Logger } from '@nestjs/common';
import type {
  IFieldTeamPort,
  WorkOrderRequest,
  WorkOrderResult,
} from '../../../domain/ports/field-team.port';

/**
 * Mock Field Team Adapter (wave-1)
 *
 * Returns static Work Order result simulating the Field-team App.
 */
@Injectable()
export class MockFieldTeamAdapter implements IFieldTeamPort {
  private readonly logger = new Logger(MockFieldTeamAdapter.name);

  async dispatchWorkOrder(req: WorkOrderRequest): Promise<WorkOrderResult> {
    this.logger.log(
      `Work Order dispatched: type=${req.incidentType} priority=${req.priority} addr=${req.address}`,
    );

    return {
      success: true,
      workOrderId: `WO-${Date.now()}`,
      estimatedArrivalMin: 45,
      crewId: 'crew-hoa-binh-01',
    };
  }
}
