/**
 * Get Reading Comparison Handler (AC#2)
 *
 * Fetches raw volumes from downstream, then BFF-computes percentageChange + direction.
 * This is presentation transformation, not business logic.
 *
 * Edge case: previousVolume === 0 → percentageChange = null, direction = 'neutral'
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { GetReadingComparisonQuery } from '../get-reading-comparison.query';
import type { ComparisonRaw, ComparisonResponse } from '../../dtos/meter-reading.dto';
import type { PortResult } from '@shared/port/port.interface';

@QueryHandler(GetReadingComparisonQuery)
export class GetReadingComparisonHandler implements IQueryHandler<GetReadingComparisonQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetReadingComparisonQuery): Promise<ComparisonResponse> {
    const result: PortResult<ComparisonRaw> = await this.portRegistry.execute<ComparisonRaw>(
      'meter-reading',
      'get-comparison',
      {
        customerId: query.customerId,
        currentPeriod: query.currentPeriod,
        previousPeriod: query.previousPeriod,
      },
    );

    // BFF presentation logic: compute percentage change + direction
    const { currentVolume, previousVolume } = result.data;
    const percentageChange = previousVolume === 0
      ? null // can't divide by zero
      : Math.round(((currentVolume - previousVolume) / previousVolume * 100) * 100) / 100;

    const direction: 'up' | 'down' | 'neutral' =
      percentageChange === null ? 'neutral'
      : percentageChange > 0 ? 'up'
      : percentageChange < 0 ? 'down'
      : 'neutral';

    return {
      ...result.data,
      percentageChange,
      direction,
    };
  }
}
