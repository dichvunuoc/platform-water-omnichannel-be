// Domain Layer Exports

// Entities
export { User } from './entities/user.entity';
export { ProviderLink } from './entities/provider-link.entity';

// Value Objects
export { UserRole, UserRoleEnum } from './value-objects/user-role.value-object';
export { UserStatus, UserStatusEnum } from './value-objects/user-status.value-object';
export { ProviderType, ProviderTypeEnum } from './value-objects/provider-type.value-object';

// Events
export { UserRegisteredEvent } from './events/user-registered.event';
export { ProviderLinkedEvent } from './events/provider-linked.event';
