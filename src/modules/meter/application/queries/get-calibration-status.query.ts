/**
 * Get Calibration Status Query (AC#2)
 *
 * Returns CalibrationStatusResponse with BFF-computed isWarning flag.
 */

import { IQuery } from '@core/application';
import type { CalibrationStatusResponse } from '../dtos/meter.dto';

export class GetCalibrationStatusQuery extends IQuery<CalibrationStatusResponse> {
  constructor(
    public readonly customerId: string,
    public readonly meterId: string,
  ) {
    super();
  }
}
