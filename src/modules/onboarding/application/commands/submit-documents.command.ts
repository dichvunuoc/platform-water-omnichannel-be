import { ICommand } from '@core/application';
import type { SubmitDocumentsResult } from '../dtos/onboarding.dto';

export class SubmitDocumentsCommand implements ICommand {
  constructor(
    public readonly requestId: string,
    public readonly customerId: string,
    public readonly documents: string[],
  ) {}
}
export type SubmitDocumentsResultType = SubmitDocumentsResult;
