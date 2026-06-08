import { User } from './user.entity';
import { ProviderLink } from './provider-link.entity';
import { ProviderType } from '../value-objects/provider-type.value-object';
import { ConflictException } from '@core/common';

describe('User Entity', () => {
  describe('register', () => {
    it('should create a new user with phone provider', () => {
      const user = User.register({
        phone: '0901234567',
        name: 'Nguyễn Văn A',
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.phone).toBe('0901234567');
      expect(user.name).toBe('Nguyễn Văn A');
      expect(user.role).toBe('customer');
      expect(user.status).toBe('active');
      expect(user.providers).toHaveLength(1);
      expect(user.providers[0].providerType).toBe(ProviderType.PHONE);
      expect(user.providers[0].providerId).toBe('0901234567');
    });

    it('should create a new user with Zalo provider', () => {
      const user = User.register({
        name: 'Zalo User',
        providerType: ProviderType.ZALO,
        providerId: 'zalo_12345',
      });

      expect(user).toBeDefined();
      expect(user.name).toBe('Zalo User');
      expect(user.providers).toHaveLength(1);
      expect(user.providers[0].providerType).toBe(ProviderType.ZALO);
      expect(user.providers[0].providerId).toBe('zalo_12345');
    });

    it('should create a new user with Google provider and email', () => {
      const user = User.register({
        email: 'test@gmail.com',
        name: 'Google User',
        providerType: ProviderType.GOOGLE,
        providerId: 'google_sub_123',
        providerEmail: 'test@gmail.com',
      });

      expect(user.email).toBe('test@gmail.com');
      expect(user.providers[0].providerEmail).toBe('test@gmail.com');
    });

    it('should emit UserRegistered domain event', () => {
      const user = User.register({
        phone: '0901234567',
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      const events = user.getDomainEvents();
      expect(events).toHaveLength(2); // ProviderLinked + UserRegistered

      // addProvider() is called first → ProviderLinked event is events[0]
      // UserRegistered event is added after → events[1]
      const registeredEvent = events.find((e) => e.eventType === 'UserRegistered');
      const linkedEvent = events.find((e) => e.eventType === 'ProviderLinked');

      expect(registeredEvent).toBeDefined();
      expect(registeredEvent!.aggregateId).toBe(user.id);
      expect(registeredEvent!.data).toEqual({
        providerType: 'phone',
        providerId: '0901234567',
      });

      expect(linkedEvent).toBeDefined();
      expect(linkedEvent!.aggregateId).toBe(user.id);
    });

    it('should default to customer role and active status', () => {
      const user = User.register({
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      expect(user.role).toBe('customer');
      expect(user.status).toBe('active');
      expect(user.email).toBeNull();
      expect(user.name).toBe('');
    });
  });

  describe('addProvider', () => {
    it('should add an additional provider to existing user', () => {
      const user = User.register({
        phone: '0901234567',
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      user.clearDomainEvents();
      user.addProvider(ProviderType.ZALO, 'zalo_12345');

      expect(user.providers).toHaveLength(2);
      expect(user.providers[1].providerType).toBe(ProviderType.ZALO);
      expect(user.providers[1].providerId).toBe('zalo_12345');
    });

    it('should emit ProviderLinked domain event', () => {
      const user = User.register({
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      user.clearDomainEvents();
      user.addProvider(ProviderType.GOOGLE, 'google_sub_123');

      const events = user.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('ProviderLinked');
      expect(events[0].data).toEqual({
        providerType: 'google',
        providerId: 'google_sub_123',
      });
    });

    it('should throw ConflictException for duplicate provider', () => {
      const user = User.register({
        phone: '0901234567',
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      expect(() => {
        user.addProvider(ProviderType.PHONE, '0901234567');
      }).toThrow(ConflictException);
    });

    it('should allow same provider type with different IDs', () => {
      const user = User.register({
        providerType: ProviderType.ZALO,
        providerId: 'zalo_12345',
      });

      user.clearDomainEvents();
      user.addProvider(ProviderType.ZALO, 'zalo_67890');

      expect(user.providers).toHaveLength(2);
    });
  });

  describe('linkPhone', () => {
    it('should set phone and add phone provider if not present', () => {
      const user = User.register({
        providerType: ProviderType.ZALO,
        providerId: 'zalo_12345',
      });

      expect(user.phone).toBeNull();
      expect(user.providers).toHaveLength(1);

      user.linkPhone('0901234567');

      expect(user.phone).toBe('0901234567');
      expect(user.providers).toHaveLength(2);
      expect(user.providers[1].providerType).toBe(ProviderType.PHONE);
    });

    it('should not add duplicate phone provider if already present', () => {
      const user = User.register({
        phone: '0901234567',
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
      });

      user.linkPhone('0901234567');

      expect(user.providers).toHaveLength(1);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute user from persistence data', () => {
      const providers = [
        ProviderLink.reconstitute({
          id: 'pl-1',
          userId: 'user-1',
          providerType: ProviderType.PHONE,
          providerId: '0901234567',
          providerEmail: null,
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      const user = User.reconstitute({
        id: 'user-1',
        version: 5,
        email: 'test@example.com',
        phone: '0901234567',
        name: 'Test User',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        providers,
      });

      expect(user.id).toBe('user-1');
      expect(user.version).toBe(5);
      expect(user.email).toBe('test@example.com');
      expect(user.phone).toBe('0901234567');
      expect(user.name).toBe('Test User');
      expect(user.role).toBe('admin');
      expect(user.providers).toHaveLength(1);
    });
  });

  describe('updateName', () => {
    it('should update user name', () => {
      const user = User.register({
        providerType: ProviderType.PHONE,
        providerId: '0901234567',
        name: 'Old Name',
      });

      user.updateName('New Name');
      expect(user.name).toBe('New Name');
    });
  });
});
