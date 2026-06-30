import { BaseValueObject, DomainException } from 'src/libs/core/domain';

/**
 * Supported inbound channels (FR1).
 */
export enum ChannelEnum {
  ZALO = 'ZALO',
  APP = 'APP',
  FACEBOOK = 'FACEBOOK',
  EMAIL = 'EMAIL',
  VOIP = 'VOIP',
}

/**
 * Channel Value Object
 *
 * Represents the source channel of a customer interaction.
 * Compared by value; validated against the supported set.
 */
export class Channel extends BaseValueObject {
  private readonly _value: ChannelEnum;

  private constructor(value: ChannelEnum) {
    super();
    this._value = value;
  }

  static create(value: string | ChannelEnum): Channel {
    const upper =
      typeof value === 'string' ? (value.toUpperCase() as ChannelEnum) : value;
    if (!Object.values(ChannelEnum).includes(upper)) {
      throw new DomainException(`Unsupported channel: ${value}`, 'INVALID_CHANNEL', {
        value,
      });
    }
    return new Channel(upper);
  }

  static zalo(): Channel {
    return new Channel(ChannelEnum.ZALO);
  }
  static app(): Channel {
    return new Channel(ChannelEnum.APP);
  }
  static facebook(): Channel {
    return new Channel(ChannelEnum.FACEBOOK);
  }
  static email(): Channel {
    return new Channel(ChannelEnum.EMAIL);
  }
  static voip(): Channel {
    return new Channel(ChannelEnum.VOIP);
  }

  get value(): ChannelEnum {
    return this._value;
  }

  /** Voice channels (VoIP/1900) need softphone handling, not text-thread. */
  get isVoice(): boolean {
    return this._value === ChannelEnum.VOIP;
  }

  protected getEqualityComponents(): unknown[] {
    return [this._value];
  }
}
