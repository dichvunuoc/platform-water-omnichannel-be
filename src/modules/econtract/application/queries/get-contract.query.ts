import { IQuery } from '@core/application';
import type { EcontractResponse } from '../dtos/econtract.dto';

export class GetContractQuery extends IQuery<EcontractResponse> {
  constructor(
    public readonly customerId: string,
    public readonly dossierId: string,
  ) {
    super();
  }
}
export type GetContractResult = EcontractResponse;
