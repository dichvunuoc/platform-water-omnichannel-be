import { ICommand } from '@core/application';
import type { MarketingPreferenceResult } from '../dtos/campaign.dto';

export class UpdateMarketingPreferenceCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly channels: { push: boolean; email: boolean; sms: boolean; zalo: boolean },
  ) {}
}
export type UpdateMarketingPreferenceResultType = MarketingPreferenceResult;
