import { BaseValueObject } from '@core/domain';

export enum UserRoleEnum {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
}

/**
 * User Role Value Object
 *
 * Represents the role of a user in the system.
 * Follows BaseValueObject pattern for equality-by-value comparison.
 */
export class UserRole extends BaseValueObject {
  private constructor(private readonly _value: UserRoleEnum) {
    super();
  }

  static CUSTOMER = new UserRole(UserRoleEnum.CUSTOMER);
  static ADMIN = new UserRole(UserRoleEnum.ADMIN);

  get value(): UserRoleEnum {
    return this._value;
  }

  static fromString(value: string): UserRole {
    switch (value) {
      case UserRoleEnum.CUSTOMER:
        return UserRole.CUSTOMER;
      case UserRoleEnum.ADMIN:
        return UserRole.ADMIN;
      default:
        throw new Error(`Invalid UserRole: ${value}`);
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this._value];
  }
}
