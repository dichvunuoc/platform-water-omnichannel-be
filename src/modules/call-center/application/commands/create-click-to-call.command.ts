import { ICommand } from '@core/application';
import type { ClickToCallResult } from '../dtos/call-center.dto';

export class CreateClickToCallCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly phoneNumber: string,
  ) {}
}
export type CreateClickToCallResult = ClickToCallResult;
