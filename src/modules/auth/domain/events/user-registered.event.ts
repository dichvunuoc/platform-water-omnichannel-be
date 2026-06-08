import { BaseDomainEvent } from '@core/domain';

export interface UserRegisteredEventData {
  providerType: string;
  providerId: string;
}

/**
 * User Registered Domain Event
 *
 * Emitted when a new user is created with their first authentication provider.
 */
export class UserRegisteredEvent extends BaseDomainEvent<UserRegisteredEventData> {
  constructor(
    aggregateId: string,
    providerType: string,
    providerId: string,
  ) {
    super(aggregateId, 'User', 'UserRegistered', {
      providerType,
      providerId,
    });
  }
}
