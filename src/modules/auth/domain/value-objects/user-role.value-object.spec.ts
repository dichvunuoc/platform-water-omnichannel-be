import { UserRole, UserRoleEnum } from './user-role.value-object';

describe('UserRole Value Object', () => {
  it('should have customer and admin roles', () => {
    expect(UserRole.CUSTOMER.value).toBe(UserRoleEnum.CUSTOMER);
    expect(UserRole.ADMIN.value).toBe(UserRoleEnum.ADMIN);
  });

  it('should parse from string correctly', () => {
    expect(UserRole.fromString('customer')).toBe(UserRole.CUSTOMER);
    expect(UserRole.fromString('admin')).toBe(UserRole.ADMIN);
  });

  it('should throw for invalid string', () => {
    expect(() => UserRole.fromString('superadmin')).toThrow('Invalid UserRole');
  });

  it('should compare equality correctly', () => {
    expect(UserRole.CUSTOMER.equals(UserRole.CUSTOMER)).toBe(true);
    expect(UserRole.ADMIN.equals(UserRole.ADMIN)).toBe(true);
    expect(UserRole.CUSTOMER.equals(UserRole.ADMIN)).toBe(false);
  });
});
