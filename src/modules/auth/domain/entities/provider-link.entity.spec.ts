import { ProviderLink } from './provider-link.entity';
import { ProviderType } from '../value-objects/provider-type.value-object';

describe('ProviderLink Entity', () => {
  describe('create', () => {
    it('should create a new provider link', () => {
      const link = ProviderLink.create('user-1', ProviderType.PHONE, '0901234567');

      expect(link).toBeDefined();
      expect(link.id).toBeDefined();
      expect(link.userId).toBe('user-1');
      expect(link.providerType).toBe(ProviderType.PHONE);
      expect(link.providerId).toBe('0901234567');
      expect(link.providerEmail).toBeNull();
      expect(link.isVerified).toBe(false);
    });

    it('should create a provider link with email', () => {
      const link = ProviderLink.create(
        'user-1',
        ProviderType.GOOGLE,
        'google_sub_123',
        'test@gmail.com',
      );

      expect(link.providerEmail).toBe('test@gmail.com');
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from persistence data', () => {
      const now = new Date();
      const link = ProviderLink.reconstitute({
        id: 'pl-1',
        userId: 'user-1',
        providerType: ProviderType.ZALO,
        providerId: 'zalo_12345',
        providerEmail: null,
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      });

      expect(link.id).toBe('pl-1');
      expect(link.userId).toBe('user-1');
      expect(link.providerType).toBe(ProviderType.ZALO);
      expect(link.isVerified).toBe(true);
    });
  });

  describe('markVerified', () => {
    it('should mark provider as verified', () => {
      const link = ProviderLink.create('user-1', ProviderType.PHONE, '0901234567');
      expect(link.isVerified).toBe(false);

      link.markVerified();
      expect(link.isVerified).toBe(true);
    });
  });
});
