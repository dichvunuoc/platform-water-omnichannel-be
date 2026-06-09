import { ContractController } from './contract.controller';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import { ValidationException } from '@core/common';
import { GetContractsQuery } from '../../application/queries/get-contracts.query';
import { GetContractDetailQuery } from '../../application/queries/get-contract-detail.query';
import { GetContractVersionsQuery } from '../../application/queries/get-contract-versions.query';
import { GetContractPDFQuery } from '../../application/queries/get-contract-pdf.query';

// NOTE: Auth/session validation (null session, missing user.id, getSession throws)
// is tested in session-auth.guard.spec.ts — not duplicated here per DRY principle.

function mockBuses() {
  return { queryBus: { execute: jest.fn() } };
}

describe('ContractController', () => {
  let controller: ContractController;
  let buses: ReturnType<typeof mockBuses>;

  const TEST_USER_ID = 'USR-SESSION-001';

  const mockContracts = {
    contracts: [{ contractId: 'CTR-001', address: 'Test', meterId: null, waterQuota: null, subscriptionType: 'residential', status: 'active', startDate: '2024-01-01', endDate: null, pricingTerms: { basePrice: 6500, currency: 'VND', billingCycle: 'monthly' } }],
    totalCount: 1,
  };

  const mockDetail = {
    contractId: 'CTR-001', address: '123 Test', meterId: 'DNG-001', waterQuota: 50,
    subscriptionType: 'residential', status: 'active', startDate: '2024-01-15', endDate: null,
    pricingTerms: { basePrice: 6500, currency: 'VND', billingCycle: 'monthly' },
    specialConditions: null,
  };

  const mockVersions = {
    versions: [{ versionId: 'VER-001', versionNumber: 1, changeDescription: 'Initial', effectiveDate: '2024-01-15', changedBy: 'System' }],
    totalCount: 1,
  };

  const mockPDF = {
    contractId: 'CTR-001', downloadUrl: 'https://storage.test/CTR-001.pdf', fileName: 'Contract.pdf', expiresAt: null,
  };

  beforeEach(() => {
    buses = mockBuses();
    controller = new ContractController(buses.queryBus as any);
  });

  // ── GET /contracts (AC#1) ──────────────────────────────────────────────────

  describe('GET /contracts', () => {
    it('should return contracts for authenticated user', async () => {
      buses.queryBus.execute.mockResolvedValue(mockContracts);

      const result = await controller.getContracts(TEST_USER_ID, {});

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetContractsQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result).toEqual(mockContracts);
    });

    it('should pass status filter to query', async () => {
      buses.queryBus.execute.mockResolvedValue(mockContracts);

      await controller.getContracts(TEST_USER_ID, { status: 'active' });

      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetContractsQuery);
      expect(callArg.filters).toEqual({ status: 'active' });
    });
  });

  // ── GET /contracts/:contractId (AC#2) ──────────────────────────────────────

  describe('GET /contracts/:contractId', () => {
    it('should return contract detail', async () => {
      buses.queryBus.execute.mockResolvedValue(mockDetail);

      const result = await controller.getContractDetail(TEST_USER_ID, 'CTR-001');

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetContractDetailQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.contractId).toBe('CTR-001');
      expect(result.pricingTerms.basePrice).toBe(6500);
    });
  });

  // ── GET /contracts/:contractId/versions (AC#3) ────────────────────────────

  describe('GET /contracts/:contractId/versions', () => {
    it('should return contract versions', async () => {
      buses.queryBus.execute.mockResolvedValue(mockVersions);

      const result = await controller.getContractVersions(TEST_USER_ID, 'CTR-001');

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetContractVersionsQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.contractId).toBe('CTR-001');
      expect(result.versions).toHaveLength(1);
    });
  });

  // ── GET /contracts/:contractId/pdf (AC#4) ─────────────────────────────────

  describe('GET /contracts/:contractId/pdf', () => {
    it('should return PDF download URL', async () => {
      buses.queryBus.execute.mockResolvedValue(mockPDF);

      const result = await controller.getContractPDF(TEST_USER_ID, 'CTR-001');

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetContractPDFQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.contractId).toBe('CTR-001');
      expect(result.downloadUrl).toContain('https://');
    });
  });

  // ── ContractId validation ──────────────────────────────────────────────────

  describe('ContractId validation', () => {
    it('should throw ValidationException for empty contractId', async () => {
      await expect(controller.getContractDetail(TEST_USER_ID, '')).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for contractId with special characters', async () => {
      await expect(controller.getContractDetail(TEST_USER_ID, '<script>alert(1)</script>')).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for contractId exceeding 100 chars', async () => {
      const longId = 'A'.repeat(101);
      await expect(controller.getContractDetail(TEST_USER_ID, longId)).rejects.toThrow(ValidationException);
    });

    it('should accept valid contractId with dashes and underscores', async () => {
      buses.queryBus.execute.mockResolvedValue(mockDetail);

      const result = await controller.getContractDetail(TEST_USER_ID, 'CTR-2024_001');
      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
    });
  });
});
