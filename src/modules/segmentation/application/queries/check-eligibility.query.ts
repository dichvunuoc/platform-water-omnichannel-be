import { IQuery } from '@core/application';
import type { CheckEligibilityResponse } from '../dtos/segmentation.dto';

export class CheckEligibilityQuery extends IQuery<CheckEligibilityResponse> {
  constructor(
    public readonly customerId: string,
    public readonly campaignId: string,
  ) {
    super();
  }
}

export type CheckEligibilityResult = CheckEligibilityResponse;
