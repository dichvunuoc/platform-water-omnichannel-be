import { ICommand } from '@core/application';
import type { CreateOnboardingResult } from '../dtos/onboarding.dto';

export class CreateOnboardingRequestCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly payload: {
      address: string;
      customerType: 'sinh_hoat' | 'san_xuat' | 'kcn';
      documents: string[];
    },
  ) {}
}
export type CreateOnboardingRequestResult = CreateOnboardingResult;
