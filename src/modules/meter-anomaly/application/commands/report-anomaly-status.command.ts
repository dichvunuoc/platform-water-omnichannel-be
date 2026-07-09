import { ICommand } from '@core/application';
import type { ReportAnomalyStatusResult } from '../dtos/meter-anomaly.dto';

export class ReportAnomalyStatusCommand implements ICommand {
  constructor(
    public readonly alertId: string,
    public readonly customerId: string,
    public readonly status: 'acknowledged' | 'false_alarm' | 'resolved',
  ) {}
}
export type ReportAnomalyStatusResultType = ReportAnomalyStatusResult;
