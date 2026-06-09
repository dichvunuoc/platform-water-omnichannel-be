import {
  MockCustomerProfileAdapter,
} from './customer-profile.port';
import {
  CustomerProfileSchema,
  TimelineResponseSchema,
  RelatedAccountsResponseSchema,
  UpdateProfileResponseSchema,
} from '../../application/dtos/customer-profile.dto';

describe('MockCustomerProfileAdapter', () => {
  let adapter: MockCustomerProfileAdapter;

  beforeEach(() => {
    adapter = new MockCustomerProfileAdapter();
  });

  // ── AC#1: get-profile ──────────────────────────────────────────────────────

  describe('execute - get-profile', () => {
    it('should read and validate get-profile.json mock data', async () => {
      const result = await adapter.execute('get-profile', {});

      expect(result).toBeDefined();
      const parsed = CustomerProfileSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.customerId).toBe('USR-20240101-0001');
        expect(parsed.data.fullName).toBe('Nguyễn Anh Tuấn');
        expect(parsed.data.classification).toBe('sinh_hoat');
        expect(parsed.data.address.fullAddress).toBeDefined();
        expect(parsed.data.contactInfo.phone).toBeDefined();
        expect(parsed.data.status).toBe('active');
      }
    });
  });

  // ── AC#2: get-timeline ─────────────────────────────────────────────────────

  describe('execute - get-timeline', () => {
    it('should read and validate get-timeline.json mock data', async () => {
      const result = await adapter.execute('get-timeline', {});

      expect(result).toBeDefined();
      const parsed = TimelineResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.entries).toBeInstanceOf(Array);
        expect(parsed.data.entries.length).toBeGreaterThan(0);
        expect(parsed.data.totalCount).toBeGreaterThan(0);

        // Verify timeline entry structure
        const entry = parsed.data.entries[0];
        expect(entry.eventType).toBeDefined();
        expect(entry.timestamp).toBeDefined();
        expect(entry.summary).toBeDefined();
      }
    });
  });

  // ── AC#4: get-related-accounts ──────────────────────────────────────────────

  describe('execute - get-related-accounts', () => {
    it('should read and validate get-related-accounts.json mock data', async () => {
      const result = await adapter.execute('get-related-accounts', {});

      expect(result).toBeDefined();
      const parsed = RelatedAccountsResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.accounts).toBeInstanceOf(Array);
        expect(parsed.data.accounts.length).toBeGreaterThan(0);

        // Verify KCN relationship tree
        const parentKcn = parsed.data.accounts.find(a => a.relationshipType === 'parent_kcn');
        expect(parentKcn).toBeDefined();
        expect(parentKcn!.name).toContain('KCN');

        const memberFactory = parsed.data.accounts.find(a => a.relationshipType === 'member_factory');
        expect(memberFactory).toBeDefined();
      }
    });
  });

  // ── AC#3: update-profile ───────────────────────────────────────────────────

  describe('execute - update-profile', () => {
    it('should read and validate update-profile.json mock data', async () => {
      const result = await adapter.execute('update-profile', {
        customerId: 'USR-20240101-0001',
        data: { phone: '0912345678' },
      });

      expect(result).toBeDefined();
      const parsed = UpdateProfileResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.customerId).toBe('USR-20240101-0001');
        expect(parsed.data.updatedFields).toBeInstanceOf(Array);
        expect(parsed.data.updatedFields.length).toBeGreaterThan(0);
        expect(parsed.data.updatedAt).toBeDefined();
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
    it('CustomerProfileSchema should reject invalid classification', () => {
      const result = CustomerProfileSchema.safeParse({
        customerId: 'test-id',
        fullName: 'Test',
        classification: 'industrial', // invalid — must be sinh_hoat/san_xuat/hanh_chinh
        address: { street: '1', ward: '2', district: '3', city: '4', fullAddress: '1, 2, 3, 4' },
        contactInfo: { phone: null, email: null, contactAddress: null },
        status: 'active',
      });
      expect(result.success).toBe(false);
    });

    it('CustomerProfileSchema should reject invalid status', () => {
      const result = CustomerProfileSchema.safeParse({
        customerId: 'test-id',
        fullName: 'Test',
        classification: 'sinh_hoat',
        address: { street: '1', ward: '2', district: '3', city: '4', fullAddress: '1, 2, 3, 4' },
        contactInfo: { phone: null, email: null, contactAddress: null },
        status: 'deleted', // invalid
      });
      expect(result.success).toBe(false);
    });

    it('TimelineResponseSchema should accept valid data', () => {
      const result = TimelineResponseSchema.safeParse({
        entries: [
          {
            eventType: 'invoice_issued',
            timestamp: '2024-01-01T00:00:00.000Z',
            summary: 'Test summary',
            channel: 'web',
            referenceId: 'REF-001',
          },
        ],
        totalCount: 1,
      });
      expect(result.success).toBe(true);
    });

    it('RelatedAccountsResponseSchema should accept valid data', () => {
      const result = RelatedAccountsResponseSchema.safeParse({
        accounts: [
          {
            customerId: 'KC-001',
            name: 'Test KCN',
            relationshipType: 'parent_kcn',
            address: 'Test Address',
            contactInfo: { phone: '0901234567' },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('UpdateProfileResponseSchema should reject missing updatedAt', () => {
      const result = UpdateProfileResponseSchema.safeParse({
        customerId: 'test-id',
        updatedFields: ['phone'],
        // missing updatedAt
      });
      expect(result.success).toBe(false);
    });
  });
});
