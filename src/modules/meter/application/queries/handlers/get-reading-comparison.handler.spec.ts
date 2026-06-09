import { GetReadingComparisonHandler } from './get-reading-comparison.handler';
import { GetReadingComparisonQuery } from '../get-reading-comparison.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';
import type { ComparisonRaw } from '../../dtos/meter-reading.dto';

describe('GetReadingComparisonHandler', () => {
  let handler: GetReadingComparisonHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetReadingComparisonHandler(portRegistry);
  });

  // ── BFF-computed percentageChange + direction ──────────────────────────────

  describe('percentageChange computation', () => {
    it('should compute direction=up when current > previous (22 vs 18 → 22.22%)', async () => {
      const raw: ComparisonRaw = {
        currentPeriod: '2025-06',
        previousPeriod: '2025-05',
        currentVolume: 22,
        previousVolume: 18,
      };
      portRegistry.execute.mockResolvedValue({
        data: raw,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(
        new GetReadingComparisonQuery('USR-001', '2025-06', '2025-05'),
      );

      expect(result.percentageChange).toBe(22.22);
      expect(result.direction).toBe('up');
    });

    it('should compute direction=down when current < previous (18 vs 22 → -18.18%)', async () => {
      const raw: ComparisonRaw = {
        currentPeriod: '2025-06',
        previousPeriod: '2025-05',
        currentVolume: 18,
        previousVolume: 22,
      };
      portRegistry.execute.mockResolvedValue({
        data: raw,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(
        new GetReadingComparisonQuery('USR-001', '2025-06', '2025-05'),
      );

      expect(result.percentageChange).toBe(-18.18);
      expect(result.direction).toBe('down');
    });

    it('should compute direction=neutral when current === previous (20 vs 20 → 0%)', async () => {
      const raw: ComparisonRaw = {
        currentPeriod: '2025-06',
        previousPeriod: '2025-05',
        currentVolume: 20,
        previousVolume: 20,
      };
      portRegistry.execute.mockResolvedValue({
        data: raw,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(
        new GetReadingComparisonQuery('USR-001', '2025-06', '2025-05'),
      );

      expect(result.percentageChange).toBe(0);
      expect(result.direction).toBe('neutral');
    });

    it('should handle division by zero: previousVolume=0 → percentageChange=null, direction=neutral', async () => {
      const raw: ComparisonRaw = {
        currentPeriod: '2025-06',
        previousPeriod: '2025-05',
        currentVolume: 5,
        previousVolume: 0,
      };
      portRegistry.execute.mockResolvedValue({
        data: raw,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(
        new GetReadingComparisonQuery('USR-001', '2025-06', '2025-05'),
      );

      expect(result.percentageChange).toBeNull();
      expect(result.direction).toBe('neutral');
    });

    it('should handle both volumes zero → percentageChange=null, direction=neutral', async () => {
      const raw: ComparisonRaw = {
        currentPeriod: '2025-06',
        previousPeriod: '2025-05',
        currentVolume: 0,
        previousVolume: 0,
      };
      portRegistry.execute.mockResolvedValue({
        data: raw,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      });

      const result = await handler.execute(
        new GetReadingComparisonQuery('USR-001', '2025-06', '2025-05'),
      );

      expect(result.percentageChange).toBeNull();
      expect(result.direction).toBe('neutral');
    });
  });

  // ── Port call verification ──────────────────────────────────────────────────

  it('should call portRegistry with correct params', async () => {
    const raw: ComparisonRaw = {
      currentPeriod: '2025-06',
      previousPeriod: '2025-05',
      currentVolume: 22,
      previousVolume: 18,
    };
    portRegistry.execute.mockResolvedValue({
      data: raw,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    await handler.execute(
      new GetReadingComparisonQuery('USR-001', '2025-06', '2025-05'),
    );

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'meter-reading',
      'get-comparison',
      {
        customerId: 'USR-001',
        currentPeriod: '2025-06',
        previousPeriod: '2025-05',
      },
    );
  });

  // ── Preserve raw downstream fields ─────────────────────────────────────────

  it('should preserve all raw downstream fields in response', async () => {
    const raw: ComparisonRaw = {
      currentPeriod: '2025-06',
      previousPeriod: '2025-05',
      currentVolume: 22,
      previousVolume: 18,
    };
    portRegistry.execute.mockResolvedValue({
      data: raw,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(
      new GetReadingComparisonQuery('USR-001', '2025-06', '2025-05'),
    );

    expect(result.currentPeriod).toBe('2025-06');
    expect(result.previousPeriod).toBe('2025-05');
    expect(result.currentVolume).toBe(22);
    expect(result.previousVolume).toBe(18);
    expect(result.percentageChange).toBe(22.22);
    expect(result.direction).toBe('up');
  });
});
