import { IQuery } from '@core/application';
import type { GetSavingsTipsResponse } from '../dtos/reporting.dto';

export class GetSavingsTipsQuery extends IQuery<GetSavingsTipsResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}
export type GetSavingsTipsResult = GetSavingsTipsResponse;
