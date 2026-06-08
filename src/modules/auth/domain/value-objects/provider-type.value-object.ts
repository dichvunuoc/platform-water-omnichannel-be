import { BaseValueObject } from '@core/domain';

export enum ProviderTypeEnum {
  PHONE = 'phone',
  ZALO = 'zalo',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  APPLE = 'apple',
}

/**
 * Provider Type Value Object
 *
 * Represents the type of authentication provider linked to a user account.
 * Follows BaseValueObject pattern for equality-by-value comparison.
 */
export class ProviderType extends BaseValueObject {
  private constructor(private readonly _value: ProviderTypeEnum) {
    super();
  }

  static PHONE = new ProviderType(ProviderTypeEnum.PHONE);
  static ZALO = new ProviderType(ProviderTypeEnum.ZALO);
  static GOOGLE = new ProviderType(ProviderTypeEnum.GOOGLE);
  static FACEBOOK = new ProviderType(ProviderTypeEnum.FACEBOOK);
  static APPLE = new ProviderType(ProviderTypeEnum.APPLE);

  get value(): ProviderTypeEnum {
    return this._value;
  }

  static fromString(value: string): ProviderType {
    switch (value) {
      case ProviderTypeEnum.PHONE:
        return ProviderType.PHONE;
      case ProviderTypeEnum.ZALO:
        return ProviderType.ZALO;
      case ProviderTypeEnum.GOOGLE:
        return ProviderType.GOOGLE;
      case ProviderTypeEnum.FACEBOOK:
        return ProviderType.FACEBOOK;
      case ProviderTypeEnum.APPLE:
        return ProviderType.APPLE;
      default:
        throw new Error(`Invalid ProviderType: ${value}`);
    }
  }

  protected getEqualityComponents(): unknown[] {
    return [this._value];
  }
}
