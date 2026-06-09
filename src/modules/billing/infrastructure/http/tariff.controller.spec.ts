import { TariffController } from './tariff.controller';
import { ValidationException } from '@core/common';
import { GetTariffPlanQuery } from '../../application/queries/get-tariff-plan.query';
import { GetTariffBreakdownQuery } from '../../application/queries/get-tariff-breakdown.query';
import { GetApplicableFeesQuery } from '../../application/queries/get-applicable-fees.query';

// NOTE: Auth/session validation tested in session-auth.guard.spec.ts — not duplicated per DRY principle.

function mockBuses() {
  return { queryBus: { execute: jest.fn() } };
}

describe('TariffController', () => {
  let controller: TariffController;
  let buses: ReturnType<typeof mockBuses>;

  const TEST_USER_ID = 'USR-SESSION-001';

  const mockTariffPlan = {
    planId: 'TARIFF-RES-2025-001',
    planName: 'Bậc thang sinh hoạt',
    customerType: 'residential',
    applicableContractId: 'CTR-2024-0001',
    tiers: [
      { tier: 1, fromVolume: 0, toVolume: 10, pricePerM3: 5973 },
      { tier: 2, fromVolume: 10, toVolume: 20, pricePerM3: 7052 },
    ],
    effectiveFrom: '2025-01-01',
    effectiveTo: null,
  };

  const mockBreakdown = {
    invoiceId: 'INV-2025-06-001',
    contractId: 'CTR-2024-0001',
    tiers: [
      { tier: 1, fromVolume: 0, toVolume: 10, volume: 10, pricePerM3: 5973, subtotal: 59730 },
    ],
    totalBeforeFees: 59730,
  };

  const mockFees = {
    contractId: 'CTR-2024-0001',
    fees: [
      { feeType: 'environmental', feeName: 'Phí bảo vệ môi trường', rate: 10, isPercentage: true },
    ],
    vatPercentage: 5,
  };

  beforeEach(() => {
    buses = mockBuses();
    controller = new TariffController(buses.queryBus as any);
  });

  // ── GET /billing/tariff/:contractId (AC#1) ──────────────────────────────────

  describe('GET /billing/tariff/:contractId', () => {
    it('should return tariff plan for contract', async () => {
      buses.queryBus.execute.mockResolvedValue(mockTariffPlan);

      const result = await controller.getTariffPlan(TEST_USER_ID, 'CTR-2024-0001');

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetTariffPlanQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.contractId).toBe('CTR-2024-0001');
      expect(result.tiers).toHaveLength(2);
    });
  });

  // ── GET /billing/tariff/:contractId/breakdown (AC#2) ────────────────────────

  describe('GET /billing/tariff/:contractId/breakdown', () => {
    it('should return tariff breakdown for invoice', async () => {
      buses.queryBus.execute.mockResolvedValue(mockBreakdown);

      const result = await controller.getTariffBreakdown(TEST_USER_ID, 'CTR-2024-0001', 'INV-2025-06-001');

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetTariffBreakdownQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.contractId).toBe('CTR-2024-0001');
      expect(callArg.invoiceId).toBe('INV-2025-06-001');
      expect(result.invoiceId).toBe('INV-2025-06-001');
    });
  });

  // ── GET /billing/tariff/:contractId/fees (AC#3) ─────────────────────────────

  describe('GET /billing/tariff/:contractId/fees', () => {
    it('should return applicable fees for contract', async () => {
      buses.queryBus.execute.mockResolvedValue(mockFees);

      const result = await controller.getApplicableFees(TEST_USER_ID, 'CTR-2024-0001');

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetApplicableFeesQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.contractId).toBe('CTR-2024-0001');
      expect(result.fees).toHaveLength(1);
      expect(result.vatPercentage).toBe(5);
    });
  });

  // ── ContractId validation ───────────────────────────────────────────────────

  describe('ContractId validation', () => {
    it('should throw ValidationException for empty contractId', async () => {
      await expect(controller.getTariffPlan(TEST_USER_ID, '')).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for special characters', async () => {
      await expect(controller.getTariffPlan(TEST_USER_ID, 'INV@LID!')).rejects.toThrow(ValidationException);
    });

    it('should accept contractId with dashes', async () => {
      buses.queryBus.execute.mockResolvedValue(mockTariffPlan);
      await controller.getTariffPlan(TEST_USER_ID, 'CTR-2024-0001');
      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationException for contractId exceeding 100 chars', async () => {
      const longId = 'A'.repeat(101);
      await expect(controller.getTariffPlan(TEST_USER_ID, longId)).rejects.toThrow(ValidationException);
    });

    it('should accept contractId with underscores', async () => {
      buses.queryBus.execute.mockResolvedValue(mockTariffPlan);
      await controller.getTariffPlan(TEST_USER_ID, 'CTR_2024_0001');
      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
    });
  });

  // ── InvoiceId validation ────────────────────────────────────────────────────

  describe('InvoiceId validation', () => {
    it('should throw ValidationException for empty invoiceId', async () => {
      await expect(
        controller.getTariffBreakdown(TEST_USER_ID, 'CTR-2024-0001', ''),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invalid invoiceId', async () => {
      await expect(
        controller.getTariffBreakdown(TEST_USER_ID, 'CTR-2024-0001', 'INV@LID!'),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for missing invoiceId (undefined)', async () => {
      await expect(
        controller.getTariffBreakdown(TEST_USER_ID, 'CTR-2024-0001', undefined as any),
      ).rejects.toThrow(ValidationException);
    });

    it('should accept valid invoiceId', async () => {
      buses.queryBus.execute.mockResolvedValue(mockBreakdown);
      await controller.getTariffBreakdown(TEST_USER_ID, 'CTR-2024-0001', 'INV-2025-06-001');
      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationException for invoiceId exceeding 100 chars', async () => {
      const longId = 'A'.repeat(101);
      await expect(
        controller.getTariffBreakdown(TEST_USER_ID, 'CTR-2024-0001', longId),
      ).rejects.toThrow(ValidationException);
    });
  });

  // ── Query class type verification ───────────────────────────────────────────

  describe('Query class types', () => {
    it('should dispatch GetTariffPlanQuery from GET /billing/tariff/:contractId', async () => {
      buses.queryBus.execute.mockResolvedValue(mockTariffPlan);
      await controller.getTariffPlan(TEST_USER_ID, 'CTR-001');
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetTariffPlanQuery);
    });

    it('should dispatch GetTariffBreakdownQuery from GET /billing/tariff/:contractId/breakdown', async () => {
      buses.queryBus.execute.mockResolvedValue(mockBreakdown);
      await controller.getTariffBreakdown(TEST_USER_ID, 'CTR-001', 'INV-001');
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetTariffBreakdownQuery);
    });

    it('should dispatch GetApplicableFeesQuery from GET /billing/tariff/:contractId/fees', async () => {
      buses.queryBus.execute.mockResolvedValue(mockFees);
      await controller.getApplicableFees(TEST_USER_ID, 'CTR-001');
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetApplicableFeesQuery);
    });
  });
});
