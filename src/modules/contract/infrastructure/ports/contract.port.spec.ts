import { MockContractAdapter } from './contract.port';
import {
  ContractListResponseSchema,
  ContractDetailResponseSchema,
  ContractVersionsResponseSchema,
  ContractPDFResponseSchema,
} from '../../application/dtos/contract.dto';

describe('MockContractAdapter', () => {
  let adapter: MockContractAdapter;

  beforeEach(() => {
    adapter = new MockContractAdapter();
  });

  // ── AC#1: get-contracts ────────────────────────────────────────────────────

  describe('execute - get-contracts', () => {
    it('should read and validate get-contracts.json mock data', async () => {
      const result = await adapter.execute('get-contracts', {});

      expect(result).toBeDefined();
      const parsed = ContractListResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.contracts).toBeInstanceOf(Array);
        expect(parsed.data.contracts.length).toBeGreaterThan(0);
        expect(parsed.data.totalCount).toBeGreaterThan(0);

        const contract = parsed.data.contracts[0];
        expect(contract.contractId).toBeDefined();
        expect(contract.address).toBeDefined();
        expect(contract.subscriptionType).toBeDefined();
        expect(contract.status).toBeDefined();
        expect(contract.pricingTerms).toBeDefined();
        expect(contract.pricingTerms!.basePrice).toBeGreaterThan(0);
      }
    });
  });

  // ── AC#2: get-contract-detail ──────────────────────────────────────────────

  describe('execute - get-contract-detail', () => {
    it('should read and validate get-contract-detail.json mock data', async () => {
      const result = await adapter.execute('get-contract-detail', { contractId: 'CTR-2024-0001' });

      expect(result).toBeDefined();
      const parsed = ContractDetailResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.contractId).toBe('CTR-2024-0001');
        expect(parsed.data.pricingTerms).toBeDefined();
        expect(parsed.data.pricingTerms.basePrice).toBeGreaterThan(0);
        expect(parsed.data.pricingTerms.currency).toBe('VND');
        expect(parsed.data.specialConditions).toBeInstanceOf(Array);
      }
    });
  });

  // ── AC#3: get-contract-versions ────────────────────────────────────────────

  describe('execute - get-contract-versions', () => {
    it('should read and validate get-contract-versions.json mock data', async () => {
      const result = await adapter.execute('get-contract-versions', { contractId: 'CTR-2024-0001' });

      expect(result).toBeDefined();
      const parsed = ContractVersionsResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.versions).toBeInstanceOf(Array);
        expect(parsed.data.versions.length).toBeGreaterThan(0);
        expect(parsed.data.totalCount).toBeGreaterThan(0);

        const version = parsed.data.versions[0];
        expect(version.versionNumber).toBeDefined();
        expect(version.changeDescription).toBeDefined();
        expect(version.effectiveDate).toBeDefined();
      }
    });
  });

  // ── AC#4: get-contract-pdf ────────────────────────────────────────────────

  describe('execute - get-contract-pdf', () => {
    it('should read and validate get-contract-pdf.json mock data', async () => {
      const result = await adapter.execute('get-contract-pdf', { contractId: 'CTR-2024-0001' });

      expect(result).toBeDefined();
      const parsed = ContractPDFResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.contractId).toBe('CTR-2024-0001');
        expect(parsed.data.downloadUrl).toContain('https://');
        expect(parsed.data.fileName).toContain('.pdf');
      }
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('execute - missing method', () => {
    it('should throw NotFoundException for missing mock file', async () => {
      await expect(adapter.execute('nonexistent', {})).rejects.toThrow();
    });
  });

  // ── Zod schema validation ──────────────────────────────────────────────────

  describe('Zod schemas validation', () => {
    it('ContractListResponseSchema should reject invalid subscriptionType', () => {
      const result = ContractListResponseSchema.safeParse({
        contracts: [{
          contractId: 'CTR-001', address: 'Test', meterId: null, waterQuota: null,
          subscriptionType: 'government', // invalid
          status: 'active', startDate: '2024-01-01', endDate: null, pricingTerms: null,
        }],
        totalCount: 1,
      });
      expect(result.success).toBe(false);
    });

    it('ContractDetailResponseSchema should accept specialConditions: null', () => {
      const result = ContractDetailResponseSchema.safeParse({
        contractId: 'CTR-001', address: 'Test', meterId: null, waterQuota: null,
        subscriptionType: 'residential', status: 'active', startDate: '2024-01-01', endDate: null,
        pricingTerms: { basePrice: 6500, currency: 'VND', billingCycle: 'monthly' },
        specialConditions: null,
      });
      expect(result.success).toBe(true);
    });

    it('ContractDetailResponseSchema should accept specialConditions as string array', () => {
      const result = ContractDetailResponseSchema.safeParse({
        contractId: 'CTR-001', address: 'Test', meterId: null, waterQuota: null,
        subscriptionType: 'residential', status: 'active', startDate: '2024-01-01', endDate: null,
        pricingTerms: { basePrice: 6500, currency: 'VND', billingCycle: 'monthly' },
        specialConditions: ['Condition A', 'Condition B'],
      });
      expect(result.success).toBe(true);
    });

    it('ContractDetailResponseSchema should reject missing pricingTerms', () => {
      const result = ContractDetailResponseSchema.safeParse({
        contractId: 'CTR-001', address: 'Test', meterId: null, waterQuota: null,
        subscriptionType: 'residential', status: 'active', startDate: '2024-01-01', endDate: null,
        // missing pricingTerms
        specialConditions: null,
      });
      expect(result.success).toBe(false);
    });

    it('ContractPDFResponseSchema should reject missing downloadUrl', () => {
      const result = ContractPDFResponseSchema.safeParse({
        contractId: 'CTR-001',
        // missing downloadUrl
        fileName: 'test.pdf',
        expiresAt: null,
      });
      expect(result.success).toBe(false);
    });
  });
});
