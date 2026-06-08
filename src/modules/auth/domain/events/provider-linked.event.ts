import { BaseDomainEvent } from '@core/domain';

export interface ProviderLinkedEventData {
  providerType: string;
  providerId: string;
}

/**
 * Provider Linked Domain Event
 *
 * Emitted when an additional provider is linked to an existing user.
 */
export class ProviderLinkedEvent extends BaseDomainEvent<ProviderLinkedEventData> {
  constructor(
    aggregateId: string,
    providerType: string,
    providerId: string,
  ) {
    super(aggregateId, 'User', 'ProviderLinked', {
      providerType,
      providerId,
    });
  }
}
