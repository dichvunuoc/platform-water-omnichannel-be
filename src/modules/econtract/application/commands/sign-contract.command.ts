import { ICommand } from '@core/application';
import type { SignContractResult } from '../dtos/econtract.dto';

export class SignContractCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly dossierId: string,
    public readonly signatureRef: string,
  ) {}
}
export type SignContractResultType = SignContractResult;
