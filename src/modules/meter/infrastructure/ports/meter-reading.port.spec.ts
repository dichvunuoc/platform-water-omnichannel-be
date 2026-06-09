import { MockMeterReadingAdapter } from './meter-reading.port';
import {
  ReadingsListResponseSchema,
  ComparisonRawSchema,
  ReadingDetailSchema,
  PeriodParamSchema,
  ComparisonQuerySchema,
} from '../../application/dtos/meter-reading.dto';

describe('MockMeterReadingAdapter', () => {
  let adapter: MockMeterReadingAdapter;

  beforeEach(() => {
    adapter = new MockMeterReadingAdapter();
  });

  // ── AC#1: get-readings (12 months for chart) ──────────────────────────────

  describe('execute - get-readings', () => {
    it('should read and validate get-readings.json mock data', async () => {
      const result = await adapter.execute('get-readings', { customerId: 'USR-001' });

      expect(result).toBeDefined();
      const parsed = ReadingsListResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.readings).toBeInstanceOf(Array);
        expect(parsed.data.readings).toHaveLength(12);
        expect(parsed.data.totalCount).toBe(12);

        const reading = parsed.data.readings[0];
        expect(reading.month).toMatch(/^\d{4}-\d{2}$/);
        expect(reading.volume).toBeGreaterThanOrEqual(0);
        expect(reading.readingDate).toBeDefined();
      }
    });

    it('should return readings with YYYY-MM month format', async () => {
      const result = await adapter.execute('get-readings', { customerId: 'USR-001' });
      const parsed = ReadingsListResponseSchema.safeParse(result);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        for (const reading of parsed.data.readings) {
          expect(reading.month).toMatch(/^\d{4}-\d{2}$/);
        }
      }
    });
  });

  // ── AC#2: get-comparison (raw volumes — no percentageChange) ──────────────

  describe('execute - get-comparison', () => {
    it('should read and validate get-comparison.json mock data', async () => {
      const result = await adapter.execute('get-comparison', { customerId: 'USR-001' });

      expect(result).toBeDefined();
      const parsed = ComparisonRawSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.currentPeriod).toBeDefined();
        expect(parsed.data.previousPeriod).toBeDefined();
        expect(parsed.data.currentVolume).toBeGreaterThanOrEqual(0);
        expect(parsed.data.previousVolume).toBeGreaterThanOrEqual(0);
      }
    });

    it('should NOT contain percentageChange in mock data (BFF-computed in handler)', async () => {
      const result = await adapter.execute('get-comparison', { customerId: 'USR-001' }) as Record<string, unknown>;
      expect(result).not.toHaveProperty('percentageChange');
      expect(result).not.toHaveProperty('direction');
    });
  });

  // ── AC#3: get-reading-detail (indices + evidence photos) ──────────────────

  describe('execute - get-reading-detail', () => {
    it('should read and validate get-reading-detail.json mock data', async () => {
      const result = await adapter.execute('get-reading-detail', { customerId: 'USR-001', period: '2025-06' });

      expect(result).toBeDefined();
      const parsed = ReadingDetailSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.period).toBeDefined();
        expect(parsed.data.previousIndex).toBeGreaterThanOrEqual(0);
        expect(parsed.data.currentIndex).toBeGreaterThanOrEqual(0);
        expect(parsed.data.volume).toBeGreaterThanOrEqual(0);
        expect(parsed.data.evidencePhotos).toBeInstanceOf(Array);
      }
    });

    it('should return evidence photos with valid URLs', async () => {
      const result = await adapter.execute('get-reading-detail', { customerId: 'USR-001', period: '2025-06' });
      const parsed = ReadingDetailSchema.safeParse(result);

      expect(parsed.success).toBe(true);
      if (parsed.success && parsed.data.evidencePhotos.length > 0) {
        const photo = parsed.data.evidencePhotos[0];
        expect(photo.url).toBeDefined();
      }
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  describe('execute - missing method', () => {
    it('should throw for missing mock file', async () => {
      await expect(adapter.execute('nonexistent', {})).rejects.toThrow();
    });
  });

  // ── PeriodParamSchema validation ────────────────────────────────────────────

  describe('PeriodParamSchema', () => {
    it('should accept valid YYYY-MM format', () => {
      expect(PeriodParamSchema.safeParse('2025-06').success).toBe(true);
    });

    it('should accept January format', () => {
      expect(PeriodParamSchema.safeParse('2024-01').success).toBe(true);
    });

    it('should reject YYYY/MM format', () => {
      expect(PeriodParamSchema.safeParse('2025/06').success).toBe(false);
    });

    it('should reject incomplete format', () => {
      expect(PeriodParamSchema.safeParse('2025').success).toBe(false);
    });

    it('should reject empty string', () => {
      expect(PeriodParamSchema.safeParse('').success).toBe(false);
    });
  });

  // ── ComparisonQuerySchema validation ────────────────────────────────────────

  describe('ComparisonQuerySchema', () => {
    it('should accept valid current and previous params', () => {
      const result = ComparisonQuerySchema.safeParse({ current: '2025-06', previous: '2025-05' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid current period', () => {
      const result = ComparisonQuerySchema.safeParse({ current: 'invalid', previous: '2025-05' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid previous period', () => {
      const result = ComparisonQuerySchema.safeParse({ current: '2025-06', previous: 'invalid' });
      expect(result.success).toBe(false);
    });
  });
});
