/**
 * Get Calibration Status Handler (AC#2)
 *
 * Fetches raw calibration from downstream, then BFF-computes isWarning flag.
 * isWarning = true when status is 'expiring_soon' or 'expired'.
 *
 * Pattern: BFF-computed UI flags — presentation logic, not business rules.
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetCalibrationStatusQuery } from '../get-calibration-status.query';
import type { CalibrationStatusRaw, CalibrationStatusResponse } from '../../dtos/meter.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetCalibrationStatusQuery)
export class GetCalibrationStatusHandler implements IQueryHandler<GetCalibrationStatusQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetCalibrationStatusQuery): Promise<CalibrationStatusResponse> {
    const result: PortResult<CalibrationStatusRaw> = await this.portRegistry.execute<CalibrationStatusRaw>(
      'meter',
      'get-calibration-status',
      { customerId: query.customerId, meterId: query.meterId },
    );

    const raw = result.data;

    // BFF presentation logic: derive isWarning for frontend badge
    const isWarning = raw.status === 'expiring_soon' || raw.status === 'expired';

    return { ...raw, isWarning };
  }
}
