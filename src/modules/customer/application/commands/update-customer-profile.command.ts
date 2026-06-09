/**
 * Update Customer Profile Command (AC#3)
 *
 * Dispatched via ICommandBus, handled by UpdateCustomerProfileHandler.
 * Handler will: update → invalidate cache → re-fetch fresh profile.
 */

import { ICommand } from '@core/application';
import type { UpdateProfileDto } from '../dtos/update-profile.dto';
import type { CustomerProfileResponse } from '../dtos/customer-profile.dto';

export class UpdateCustomerProfileCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly data: UpdateProfileDto,
  ) {}
}

/**
 * Type alias for the handler's return type.
 * The handler returns a fresh CustomerProfileResponse after cache invalidation.
 */
export type UpdateCustomerProfileResult = CustomerProfileResponse;
