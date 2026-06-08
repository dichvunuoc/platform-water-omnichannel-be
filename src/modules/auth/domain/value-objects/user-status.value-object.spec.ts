import { UserStatus, UserStatusEnum } from './user-status.value-object';

describe('UserStatus Value Object', () => {
  it('should have all status values', () => {
    expect(UserStatus.ACTIVE.value).toBe(UserStatusEnum.ACTIVE);
    expect(UserStatus.SUSPENDED.value).toBe(UserStatusEnum.SUSPENDED);
    expect(UserStatus.DELETED.value).toBe(UserStatusEnum.DELETED);
  });

  it('should parse from string correctly', () => {
    expect(UserStatus.fromString('active')).toBe(UserStatus.ACTIVE);
    expect(UserStatus.fromString('suspended')).toBe(UserStatus.SUSPENDED);
    expect(UserStatus.fromString('deleted')).toBe(UserStatus.DELETED);
  });

  it('should throw for invalid string', () => {
    expect(() => UserStatus.fromString('banned')).toThrow('Invalid UserStatus');
  });

  it('should compare equality correctly', () => {
    expect(UserStatus.ACTIVE.equals(UserStatus.ACTIVE)).toBe(true);
    expect(UserStatus.ACTIVE.equals(UserStatus.SUSPENDED)).toBe(false);
  });
});
