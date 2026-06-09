/**
 * Get Contract PDF Query (AC#4)
 *
 * Dispatched via IQueryBus, handled by GetContractPDFHandler.
 */

import { IQuery } from '@core/application';
import type { ContractPDFResponse } from '../dtos/contract.dto';

export class GetContractPDFQuery extends IQuery<ContractPDFResponse> {
  constructor(
    public readonly customerId: string,
    public readonly contractId: string,
  ) {
    super();
  }
}
