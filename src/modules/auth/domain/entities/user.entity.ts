import { AggregateRoot } from '@core/domain';
import { ConflictException } from '@core/common';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { ProviderLinkedEvent } from '../events/provider-linked.event';
import { ProviderType } from '../value-objects/provider-type.value-object';
import { UserRole } from '../value-objects/user-role.value-object';
import { UserStatus } from '../value-objects/user-status.value-object';
import { ProviderLink } from './provider-link.entity';

/**
 * User Aggregate Root
 *
 * The central identity entity for customer authentication.
 * Extends AggregateRoot from @core/domain for domain events and OCC support.
 *
 * Invariants:
 * - A user must have at least one provider link
 * - Duplicate provider type+id combinations are not allowed
 * - PII fields (phone, email) are stored encrypted at rest (handled by infrastructure layer)
 * - Role and Status are enforced via Value Objects (UserRole, UserStatus)
 */
export class User extends AggregateRoot {
  private _email: string | null;
  private _phone: string | null;
  private _name: string;
  private _role: UserRole;
  private _status: UserStatus;
  private _providers: ProviderLink[];

  private constructor(
    id: string,
    version: number,
    email: string | null,
    phone: string | null,
    name: string,
    role: UserRole,
    status: UserStatus,
    createdAt?: Date,
    updatedAt?: Date,
    providers: ProviderLink[] = [],
  ) {
    super(id, version, createdAt, updatedAt);
    this._email = email;
    this._phone = phone;
    this._name = name;
    this._role = role;
    this._status = status;
    this._providers = providers;
  }

  // --- Getters ---

  get email(): string | null {
    return this._email;
  }
  get phone(): string | null {
    return this._phone;
  }
  get name(): string {
    return this._name;
  }
  get role(): string {
    return this._role.value;
  }
  get status(): string {
    return this._status.value;
  }
  get providers(): ProviderLink[] {
    return [...this._providers];
  }

  // --- Factory Method ---

  /**
   * Register a new user with their first authentication provider.
   * Emits UserRegistered domain event.
   */
  static register(params: {
    phone?: string;
    email?: string;
    name?: string;
    providerType: ProviderType;
    providerId: string;
    providerEmail?: string;
  }): User {
    const id = crypto.randomUUID();
    const user = new User(
      id,
      0,
      params.email ?? null,
      params.phone ?? null,
      params.name ?? '',
      UserRole.CUSTOMER,
      UserStatus.ACTIVE,
    );

    // Add initial provider link
    user.addProvider(params.providerType, params.providerId, params.providerEmail);

    // Emit domain event
    user.addDomainEvent(
      new UserRegisteredEvent(id, params.providerType.value, params.providerId),
    );

    return user;
  }

  // --- Behavior Methods ---

  /**
   * Link an additional provider to this user.
   * Prevents duplicate provider type+id combinations.
   * Emits ProviderLinked domain event.
   */
  addProvider(
    providerType: ProviderType,
    providerId: string,
    providerEmail?: string,
  ): void {
    if (
      this._providers.some(
        (p) =>
          p.providerType.equals(providerType) && p.providerId === providerId,
      )
    ) {
      throw ConflictException.duplicate(
        'Provider',
        `${providerType.value}:${providerId}`,
        providerId,
      );
    }

    const link = ProviderLink.create(
      this.id,
      providerType,
      providerId,
      providerEmail,
    );
    this._providers.push(link);

    this.addDomainEvent(
      new ProviderLinkedEvent(this.id, providerType.value, providerId),
    );
  }

  /**
   * Link a phone number to this user (from provider merge).
   * If phone provider already exists, this is a no-op for the provider link.
   */
  linkPhone(phone: string): void {
    this._phone = phone;
    if (!this._providers.some((p) => p.providerType.equals(ProviderType.PHONE))) {
      this.addProvider(ProviderType.PHONE, phone);
    }
  }

  /**
   * Update user name
   */
  updateName(name: string): void {
    this._name = name;
  }

  // --- Reconstitution ---

  /**
   * Reconstitute a User from persistence layer.
   * Role and Status are validated via Value Objects — invalid values throw.
   */
  static reconstitute(params: {
    id: string;
    version: number;
    email: string | null;
    phone: string | null;
    name: string;
    role: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    providers: ProviderLink[];
  }): User {
    return new User(
      params.id,
      params.version,
      params.email,
      params.phone,
      params.name,
      UserRole.fromString(params.role),   // Validates via VO — throws on invalid
      UserStatus.fromString(params.status), // Validates via VO — throws on invalid
      params.createdAt,
      params.updatedAt,
      params.providers,
    );
  }
}
