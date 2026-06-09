import { CustomerController } from './customer.controller';
import { QUERY_BUS_TOKEN, COMMAND_BUS_TOKEN } from '@core/constants/tokens';
import { ValidationException } from '@core/common';
import { GetCustomerProfileQuery } from '../../application/queries/get-customer-profile.query';
import { GetCustomerTimelineQuery } from '../../application/queries/get-customer-timeline.query';
import { GetRelatedAccountsQuery } from '../../application/queries/get-related-accounts.query';
import { UpdateCustomerProfileCommand } from '../../application/commands/update-customer-profile.command';

// NOTE: Auth/session validation (null session, missing user.id, getSession throws)
// is tested in session-auth.guard.spec.ts — not duplicated here per DRY principle.

/**
 * Build a mock query bus and command bus.
 */
function mockBuses() {
  return {
    queryBus: { execute: jest.fn() },
    commandBus: { execute: jest.fn() },
  };
}

describe('CustomerController', () => {
  let controller: CustomerController;
  let buses: ReturnType<typeof mockBuses>;

  const TEST_USER_ID = 'USR-SESSION-001';

  const mockProfile = {
    customerId: 'USR-SESSION-001',
    fullName: 'Test User',
    classification: 'sinh_hoat',
    address: { street: '1', ward: '2', district: '3', city: '4', fullAddress: '1, 2, 3, 4' },
    contactInfo: { phone: '0901234567', email: null, contactAddress: null },
    status: 'active',
  };

  const mockTimeline = {
    entries: [
      { eventType: 'invoice_issued', timestamp: '2024-01-01T00:00:00.000Z', summary: 'Test', channel: null, referenceId: 'REF-001' },
    ],
    totalCount: 1,
  };

  const mockRelatedAccounts = {
    accounts: [
      { customerId: 'USR-KCN-001', name: 'KCN Test', relationshipType: 'parent_kcn', address: 'KCN', contactInfo: { phone: '028' } },
    ],
  };

  beforeEach(() => {
    buses = mockBuses();
    controller = new CustomerController(
      buses.queryBus as any,
      buses.commandBus as any,
    );
  });

  // ── GET /customers/profile (AC#1) ──────────────────────────────────────────

  describe('GET /customers/profile', () => {
    it('should return customer profile for authenticated user', async () => {
      buses.queryBus.execute.mockResolvedValue(mockProfile);

      const result = await controller.getProfile(TEST_USER_ID);

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetCustomerProfileQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result).toEqual(mockProfile);
    });
  });

  // ── GET /customers/timeline (AC#2) ─────────────────────────────────────────

  describe('GET /customers/timeline', () => {
    it('should return timeline for authenticated user', async () => {
      buses.queryBus.execute.mockResolvedValue(mockTimeline);

      const result = await controller.getTimeline(TEST_USER_ID);

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetCustomerTimelineQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result).toEqual(mockTimeline);
      expect(result.entries).toHaveLength(1);
    });
  });

  // ── GET /customers/related-accounts (AC#4) ──────────────────────────────────

  describe('GET /customers/related-accounts', () => {
    it('should return related accounts for authenticated user', async () => {
      buses.queryBus.execute.mockResolvedValue(mockRelatedAccounts);

      const result = await controller.getRelatedAccounts(TEST_USER_ID);

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetRelatedAccountsQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result).toEqual(mockRelatedAccounts);
      expect(result.accounts[0].relationshipType).toBe('parent_kcn');
    });
  });

  // ── PUT /customers/profile (AC#3) ──────────────────────────────────────────

  describe('PUT /customers/profile', () => {
    it('should update profile and return fresh data', async () => {
      const updatedProfile = { ...mockProfile, contactInfo: { ...mockProfile.contactInfo, phone: '0912345678' } };
      buses.commandBus.execute.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(
        TEST_USER_ID,
        { phone: '0912345678' },
      );

      expect(buses.commandBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.commandBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(UpdateCustomerProfileCommand);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.data).toEqual({ phone: '0912345678' });
      expect(result.contactInfo.phone).toBe('0912345678');
    });

    it('should throw ValidationException for empty string phone', async () => {
      await expect(
        controller.updateProfile(TEST_USER_ID, { phone: '' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invalid email format', async () => {
      await expect(
        controller.updateProfile(TEST_USER_ID, { email: 'not-an-email' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for empty string contactAddress', async () => {
      await expect(
        controller.updateProfile(TEST_USER_ID, { contactAddress: '' }),
      ).rejects.toThrow(ValidationException);
    });

    it('should accept valid email update', async () => {
      buses.commandBus.execute.mockResolvedValue(mockProfile);

      await controller.updateProfile(TEST_USER_ID, { email: 'new@email.com' });

      expect(buses.commandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should accept valid contactAddress update', async () => {
      buses.commandBus.execute.mockResolvedValue(mockProfile);

      await controller.updateProfile(TEST_USER_ID, { contactAddress: '456 New Street' });

      expect(buses.commandBus.execute).toHaveBeenCalledTimes(1);
    });
  });
});
