import { MockTariffAdapter } from './tariff.port';
import {
  TariffPlanSchema,
  TariffTierSchema,
  TariffBreakdownSchema,
  ApplicableFeeSchema,
  ApplicableFeesResponseSchema,
  ContractIdParamSchema,
} from '../../application/dtos/tariff.dto';
import { InvoiceIdParamSchema } from '../../application/dtos/invoice.dto';

describe('MockTariffAdapter', () => {
  let adapter: MockTariffAdapter;

  beforeEach(() => {
    adapter = new MockTariffAdapter();
  });

  // ── AC#1: get-tariff-plan (4-tier residential bậc thang) ──────────────────

  describe('execute - get-tariff-plan', () => {
    it('should read and validate get-tariff-plan.json mock data', async () => {
      const result = await adapter.execute('get-tariff-plan', { contractId: 'CTR-2024-0001' });

      expect(result).toBeDefined();
      const parsed = TariffPlanSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.planId).toBeDefined();
        expect(parsed.data.planName).toBeDefined();
        expect(parsed.data.customerType).toBe('residential');
        expect(parsed.data.tiers).toBeInstanceOf(Array);
        expect(parsed.data.tiers).toHaveLength(4);
        expect(parsed.data.effectiveFrom).toBeDefined();
      }
    });

    it('should return 4-tier residential pricing table', async () => {
      const result = await adapter.execute('get-tariff-plan', { contractId: 'CTR-2024-0001' });
      const parsed = TariffPlanSchema.safeParse(result);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        const tiers = parsed.data.tiers;
        expect(tiers[0].tier).toBe(1);
        expect(tiers[0].fromVolume).toBe(0);
        expect(tiers[0].toVolume).toBe(10);
        expect(tiers[0].pricePerM3).toBeGreaterThan(0);

        // Last tier has null toVolume (unlimited)
        expect(tiers[tiers.length - 1].toVolume).toBeNull();
      }
    });

    it('should have increasing prices per tier', async () => {
      const result = await adapter.execute('get-tariff-plan', { contractId: 'CTR-2024-0001' });
      const parsed = TariffPlanSchema.safeParse(result);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        const tiers = parsed.data.tiers;
        for (let i = 1; i < tiers.length; i++) {
          expect(tiers[i].pricePerM3).toBeGreaterThan(tiers[i - 1].pricePerM3);
        }
      }
    });
  });

  // ── AC#2: get-tariff-breakdown (invoice-specific) ──────────────────────────

  describe('execute - get-tariff-breakdown', () => {
    it('should read and validate get-tariff-breakdown.json mock data', async () => {
      const result = await adapter.execute('get-tariff-breakdown', {
        contractId: 'CTR-2024-0001',
        invoiceId: 'INV-2025-06-001',
      });

      expect(result).toBeDefined();
      const parsed = TariffBreakdownSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.invoiceId).toBe('INV-2025-06-001');
        expect(parsed.data.contractId).toBe('CTR-2024-0001');
        expect(parsed.data.tiers).toBeInstanceOf(Array);
        expect(parsed.data.tiers.length).toBeGreaterThan(0);
        expect(parsed.data.totalBeforeFees).toBeGreaterThan(0);
      }
    });

    it('should have correct subtotals (volume × pricePerM3)', async () => {
      const result = await adapter.execute('get-tariff-breakdown', {
        contractId: 'CTR-2024-0001',
        invoiceId: 'INV-2025-06-001',
      });
      const parsed = TariffBreakdownSchema.safeParse(result);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        for (const tier of parsed.data.tiers) {
          expect(tier.subtotal).toBe(tier.volume * tier.pricePerM3);
        }
      }
    });

    it('should have totalBeforeFees equal sum of tier subtotals', async () => {
      const result = await adapter.execute('get-tariff-breakdown', {
        contractId: 'CTR-2024-0001',
        invoiceId: 'INV-2025-06-001',
      });
      const parsed = TariffBreakdownSchema.safeParse(result);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        const sumSubtotals = parsed.data.tiers.reduce((sum, t) => sum + t.subtotal, 0);
        expect(parsed.data.totalBeforeFees).toBe(sumSubtotals);
      }
    });
  });

  // ── AC#3: get-applicable-fees ──────────────────────────────────────────────

  describe('execute - get-applicable-fees', () => {
    it('should read and validate get-applicable-fees.json mock data', async () => {
      const result = await adapter.execute('get-applicable-fees', { contractId: 'CTR-2024-0001' });

      expect(result).toBeDefined();
      const parsed = ApplicableFeesResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.contractId).toBe('CTR-2024-0001');
        expect(parsed.data.fees).toBeInstanceOf(Array);
        expect(parsed.data.fees.length).toBeGreaterThan(0);
        expect(parsed.data.vatPercentage).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have valid fee types', async () => {
      const result = await adapter.execute('get-applicable-fees', { contractId: 'CTR-2024-0001' });
      const parsed = ApplicableFeesResponseSchema.safeParse(result);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        const validTypes = ['environmental', 'drainage', 'vat', 'surcharge'];
        for (const fee of parsed.data.fees) {
          expect(validTypes).toContain(fee.feeType);
          expect(fee.feeName).toBeDefined();
        }
      }
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  describe('execute - missing method', () => {
    it('should throw for missing mock file', async () => {
      await expect(adapter.execute('nonexistent', {})).rejects.toThrow();
    });
  });

  // ── Input validation schemas ────────────────────────────────────────────────

  describe('ContractIdParamSchema', () => {
    it('should accept valid contract IDs', () => {
      expect(ContractIdParamSchema.safeParse('CTR-2024-0001').success).toBe(true);
    });

    it('should reject IDs with special characters', () => {
      expect(ContractIdParamSchema.safeParse('INV@LID!').success).toBe(false);
    });

    it('should reject empty string', () => {
      expect(ContractIdParamSchema.safeParse('').success).toBe(false);
    });
  });

  describe('InvoiceIdParamSchema', () => {
    it('should accept valid invoice IDs', () => {
      expect(InvoiceIdParamSchema.safeParse('INV-2025-06-001').success).toBe(true);
    });

    it('should reject IDs with special characters', () => {
      expect(InvoiceIdParamSchema.safeParse('INV@LID').success).toBe(false);
    });
  });

  // ── Zod schema rejection tests ──────────────────────────────────────────────

  describe('Zod schema validation', () => {
    it('TariffPlanSchema should reject invalid customerType', () => {
      const result = TariffPlanSchema.safeParse({
        planId: 'T-001',
        planName: 'Test',
        customerType: 'government', // invalid — not in enum
        applicableContractId: 'CTR-001',
        tiers: [{ tier: 1, fromVolume: 0, toVolume: 10, pricePerM3: 5000 }],
        effectiveFrom: '2025-01-01',
        effectiveTo: null,
      });
      expect(result.success).toBe(false);
    });

    it('TariffTierSchema should reject negative pricePerM3', () => {
      const result = TariffTierSchema.safeParse({
        tier: 1,
        fromVolume: 0,
        toVolume: 10,
        pricePerM3: -100, // invalid — must be positive
      });
      expect(result.success).toBe(false);
    });

    it('TariffTierSchema should reject zero tier number', () => {
      const result = TariffTierSchema.safeParse({
        tier: 0, // invalid — must be positive
        fromVolume: 0,
        toVolume: 10,
        pricePerM3: 5000,
      });
      expect(result.success).toBe(false);
    });

    it('ApplicableFeeSchema should reject invalid feeType', () => {
      const result = ApplicableFeeSchema.safeParse({
        feeType: 'tax', // invalid — not in enum
        feeName: 'Test',
        rate: 10,
        isPercentage: true,
      });
      expect(result.success).toBe(false);
    });

    it('TariffPlanSchema should reject empty tiers array', () => {
      const result = TariffPlanSchema.safeParse({
        planId: 'T-001',
        planName: 'Test',
        customerType: 'residential',
        applicableContractId: 'CTR-001',
        tiers: [], // invalid — min(1)
        effectiveFrom: '2025-01-01',
        effectiveTo: null,
      });
      expect(result.success).toBe(false);
    });
  });
});
