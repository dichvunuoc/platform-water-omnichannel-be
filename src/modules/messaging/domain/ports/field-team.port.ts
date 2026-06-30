/**
 * Field Team Port (FR62) — dispatch a Work Order to the Field-team App.
 * Consumed from the Field-team App (mock wave-1 → real wave-3).
 */
export interface IFieldTeamPort {
  dispatchWorkOrder(request: WorkOrderRequest): Promise<WorkOrderResult>;
}

export interface WorkOrderRequest {
  incidentType: string;
  priority: string;
  address: string;
  photoUrls: string[];
  conversationId: string;
  customerId?: string;
}

export interface WorkOrderResult {
  success: boolean;
  workOrderId?: string;
  estimatedArrivalMin?: number;
  crewId?: string;
  error?: string;
}
