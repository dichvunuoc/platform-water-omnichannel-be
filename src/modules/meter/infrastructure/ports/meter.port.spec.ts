import { MockMeterAdapter } from './meter.port';
import {
  MeterListResponseSchema,
  CalibrationStatusRawSchema,
  MeterHistoryResponseSchema,
  MeterInfoSchema,
  MeterIdParamSchema,
} from '../../application/dtos/meter.dto';

describe('MockMeterAdapter', () => {
  let adapter: MockMeterAdapter;

  beforeEach(() => {
    adapter = new MockMeterAdapter();
  });

  // ── AC#1: get-meter-by-customer (1:N — returns array) ──────────────────────

  describe('execute - get-meter-by-customer', () => {
    it('should read and validate get-meter-by-customer.json mock data', async () => {
      const result = await adapter.execute('get-meter-by-customer', { customerId: 'USR-12345' });

      expect(result).toBeDefined();
      const parsed = MeterListResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.meters).toBeInstanceOf(Array);
        expect(parsed.data.meters.length).toBeGreaterThan(0);
        expect(parsed.data.totalCount).toBeGreaterThan(0);

        const meter = parsed.data.meters[0];
        expect(meter.meterId).toBeDefined();
        expect(meter.serialNumber).toBeDefined();
        expect(meter.type).toBeDefined();
        expect(meter.diameter).toMatch(/^DN\d+$/);
        expect(meter.accuracyClass).toBeDefined();
        expect(meter.manufactureYear).toBeGreaterThan(2000);
        expect(meter.status).toBeDefined();
      }
    });

    it('should return multiple meters (1:N relationship)', async () => {
      const result = await adapter.execute('get-meter-by-customer', { customerId: 'USR-12345' });
      const parsed = MeterListResponseSchema.safeParse(result);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        // Customer has multiple contracts → multiple meters
        expect(parsed.data.meters.length).toBeGreaterThanOrEqual(2);
        expect(parsed.data.totalCount).toBe(parsed.data.meters.length);
      }
    });
  });

  // ── AC#2: get-calibration-status (raw — no isWarning in mock JSON) ─────────

  describe('execute - get-calibration-status', () => {
    it('should read and validate get-calibration-status.json mock data', async () => {
      const result = await adapter.execute('get-calibration-status', { meterId: 'MT-001' });

      expect(result).toBeDefined();
      const parsed = CalibrationStatusRawSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.meterId).toBe('MT-001');
        expect(['valid', 'expiring_soon', 'expired']).toContain(parsed.data.status);
        expect(parsed.data.lastCalibrationDate).toBeDefined();
        expect(parsed.data.nextCalibrationDate).toBeDefined();
      }
    });

    it('should NOT contain isWarning in mock data (BFF-computed in handler)', async () => {
      const result = await adapter.execute('get-calibration-status', { meterId: 'MT-001' }) as Record<string, unknown>;
      // isWarning is added by handler, not in mock JSON
      expect(result).not.toHaveProperty('isWarning');
    });
  });

  // ── AC#3: get-meter-history ─────────────────────────────────────────────────

  describe('execute - get-meter-history', () => {
    it('should read and validate get-meter-history.json mock data', async () => {
      const result = await adapter.execute('get-meter-history', { meterId: 'MT-001' });

      expect(result).toBeDefined();
      const parsed = MeterHistoryResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.entries).toBeInstanceOf(Array);
        expect(parsed.data.entries.length).toBeGreaterThan(0);
        expect(parsed.data.totalCount).toBeGreaterThan(0);

        const entry = parsed.data.entries[0];
        expect(entry.eventDate).toBeDefined();
        expect(['installation', 'removal', 'replacement', 'calibration']).toContain(entry.eventType);
        expect(entry.description).toBeDefined();
        expect(entry.performedBy).toBeDefined();
      }
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  describe('execute - missing method', () => {
    it('should throw for missing mock file', async () => {
      await expect(adapter.execute('nonexistent', {})).rejects.toThrow();
    });
  });

  // ── Zod schema validation ───────────────────────────────────────────────────

  describe('Zod schemas validation', () => {
    it('MeterListResponseSchema should reject single object (must be array)', () => {
      const result = MeterListResponseSchema.safeParse({
        meterId: 'MT-001', // wrong: single object, not array
        serialNumber: 'SN-001',
      });
      expect(result.success).toBe(false);
    });

    it('MeterInfoSchema should reject invalid meter type', () => {
      const result = MeterInfoSchema.safeParse({
        meterId: 'MT-001',
        serialNumber: 'SN-001',
        type: 'nuclear', // invalid
        diameter: 'DN15',
        accuracyClass: 'Class B',
        manufactureYear: 2024,
        installationDate: '2024-01-01',
        status: 'active',
      });
      expect(result.success).toBe(false);
    });

    it('CalibrationStatusRawSchema should reject invalid status', () => {
      const result = CalibrationStatusRawSchema.safeParse({
        meterId: 'MT-001',
        status: 'unknown', // invalid
        lastCalibrationDate: '2024-01-01',
        nextCalibrationDate: '2026-01-01',
        certificateNumber: null,
      });
      expect(result.success).toBe(false);
    });
  });

  // ── MeterIdParamSchema validation ───────────────────────────────────────────

  describe('MeterIdParamSchema', () => {
    it('should accept alphanumeric IDs', () => {
      expect(MeterIdParamSchema.safeParse('MT001').success).toBe(true);
    });

    it('should accept IDs with dashes', () => {
      expect(MeterIdParamSchema.safeParse('MT-001').success).toBe(true);
    });

    it('should accept IDs with underscores', () => {
      expect(MeterIdParamSchema.safeParse('MT-001_A').success).toBe(true);
    });

    it('should reject IDs with special characters', () => {
      expect(MeterIdParamSchema.safeParse('INV@LID!').success).toBe(false);
    });

    it('should reject empty string', () => {
      expect(MeterIdParamSchema.safeParse('').success).toBe(false);
    });
  });
});
