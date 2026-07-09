import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import type { PortResult } from '@shared/port/port.interface';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { CheckEligibilityQuery, CheckEligibilityResult } from '../check-eligibility.query';
import type { CheckEligibilityResponse } from '../../dtos/segmentation.dto';

@QueryHandler(CheckEligibilityQuery)
export class CheckEligibilityHandler implements IQueryHandler<CheckEligibilityQuery> {
  private readonly logger = new Logger(CheckEligibilityHandler.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: CheckEligibilityQuery): Promise<CheckEligibilityResult> {
    const result: PortResult<CheckEligibilityResponse> =
      await this.portRegistry.execute<CheckEligibilityResponse>(
        'segmentation',
        'check-eligibility',
        { customerId: query.customerId, campaignId: query.campaignId },
      );
    const data = result?.data;
    if (!data) throw new PortFallbackException('segmentation');
    return data;
  }
}
