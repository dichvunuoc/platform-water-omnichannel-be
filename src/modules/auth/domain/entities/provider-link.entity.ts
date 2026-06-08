import { BaseEntity } from '@core/domain';
import { ProviderType } from '../value-objects/provider-type.value-object';

/**
 * Provider Link Entity (Child Entity within User Aggregate)
 *
 * Represents a linked authentication provider (phone, zalo, google, etc.)
 * Does NOT extend AggregateRoot — only the User aggregate root can emit events.
 */
export class ProviderLink extends BaseEntity {
  private _userId: string;
  private _providerType: ProviderType;
  private _providerId: string;
  private _providerEmail: string | null;
  private _isVerified: boolean;

  private constructor(
    id: string,
    userId: string,
    providerType: ProviderType,
    providerId: string,
    providerEmail: string | null,
    isVerified: boolean,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
    this._userId = userId;
    this._providerType = providerType;
    this._providerId = providerId;
    this._providerEmail = providerEmail;
    this._isVerified = isVerified;
  }

  get userId(): string {
    return this._userId;
  }
  get providerType(): ProviderType {
    return this._providerType;
  }
  get providerId(): string {
    return this._providerId;
  }
  get providerEmail(): string | null {
    return this._providerEmail;
  }
  get isVerified(): boolean {
    return this._isVerified;
  }

  /**
   * Factory method — create a new provider link
   */
  static create(
    userId: string,
    providerType: ProviderType,
    providerId: string,
    providerEmail?: string,
  ): ProviderLink {
    const id = crypto.randomUUID();
    return new ProviderLink(
      id,
      userId,
      providerType,
      providerId,
      providerEmail ?? null,
      false,
    );
  }

  /**
   * Reconstitute from persistence
   */
  static reconstitute(params: {
    id: string;
    userId: string;
    providerType: ProviderType;
    providerId: string;
    providerEmail: string | null;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ProviderLink {
    return new ProviderLink(
      params.id,
      params.userId,
      params.providerType,
      params.providerId,
      params.providerEmail,
      params.isVerified,
      params.createdAt,
      params.updatedAt,
    );
  }

  /**
   * Mark provider as verified
   */
  markVerified(): void {
    this._isVerified = true;
    this.updatedAt = new Date();
  }
}
