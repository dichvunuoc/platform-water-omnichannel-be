import { IQuery } from '@core/application';
import type { SmartMeterStatus } from '../dtos/smart-meter.dto';

export class GetMeterStatusQuery extends IQuery<SmartMeterStatus> {
  constructor(public readonly meterId: string) {
    super();
  }
}
export type GetMeterStatusResult = SmartMeterStatus;
