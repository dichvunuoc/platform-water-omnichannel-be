import { ProviderType, ProviderTypeEnum } from './provider-type.value-object';

describe('ProviderType Value Object', () => {
  it('should create all provider types', () => {
    expect(ProviderType.PHONE.value).toBe(ProviderTypeEnum.PHONE);
    expect(ProviderType.ZALO.value).toBe(ProviderTypeEnum.ZALO);
    expect(ProviderType.GOOGLE.value).toBe(ProviderTypeEnum.GOOGLE);
    expect(ProviderType.FACEBOOK.value).toBe(ProviderTypeEnum.FACEBOOK);
    expect(ProviderType.APPLE.value).toBe(ProviderTypeEnum.APPLE);
  });

  it('should parse from string correctly', () => {
    expect(ProviderType.fromString('phone')).toBe(ProviderType.PHONE);
    expect(ProviderType.fromString('zalo')).toBe(ProviderType.ZALO);
    expect(ProviderType.fromString('google')).toBe(ProviderType.GOOGLE);
    expect(ProviderType.fromString('facebook')).toBe(ProviderType.FACEBOOK);
    expect(ProviderType.fromString('apple')).toBe(ProviderType.APPLE);
  });

  it('should throw for invalid string', () => {
    expect(() => ProviderType.fromString('invalid')).toThrow('Invalid ProviderType');
  });

  it('should compare equality correctly', () => {
    expect(ProviderType.PHONE.equals(ProviderType.PHONE)).toBe(true);
    expect(ProviderType.ZALO.equals(ProviderType.ZALO)).toBe(true);
    expect(ProviderType.GOOGLE.equals(ProviderType.FACEBOOK)).toBe(false);
    expect(ProviderType.PHONE.equals(ProviderType.ZALO)).toBe(false);
  });
});
