import { BaseValueObject } from '@core/domain';

export enum UserStatusEnum {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

/**
 * User Status Value Object
 *
 * Represents the lifecycle status of a user account.
 * Follows BaseValueObject pattern for equality-by-value comparison.
 */
export class UserStatus extends BaseValueObject {
  private constructor(private readonly _value: UserStatusEnum) {
    super();
  }

  static ACTIVE = new UserStatus(UserStatusEnum.ACTIVE);
  static SUSPENDED = new UserStatus(UserStatusEnum.SUSPENDED);
  static DELETED = new UserStatus(UserStatusEnum.DELETED);

  get value(): UserStatusEnum {
    return this._value;
  }

  static fromString(value: string): UserStatus {
    switch (value) {
      case UserStatusEnum.ACTIVE:
        return UserStatus.ACTIVE;
      case UserStatusEnum.SUSPENDED:
        return UserStatus.SUSPENDED;
      case UserStatusEnum.DELETED:
        return UserStatus.DELETED;
      default:
        throw new Error(`Invalid UserStatus: ${value}`);
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this._value];
  }
}
