import { IQuery } from '@core/application';
import type { MarketingMessagesResponse } from '../dtos/campaign.dto';

export class GetMarketingMessagesQuery extends IQuery<MarketingMessagesResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}
export type GetMarketingMessagesResult = MarketingMessagesResponse;
