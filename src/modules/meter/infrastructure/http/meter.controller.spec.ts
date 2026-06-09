import { MeterController } from './meter.controller';
import { ValidationException } from '@core/common';
import { GetMeterByCustomerQuery } from '../../application/queries/get-meter-by-customer.query';
import { GetCalibrationStatusQuery } from '../../application/queries/get-calibration-status.query';
import { GetMeterHistoryQuery } from '../../application/queries/get-meter-history.query';
import { GetReadingsQuery } from '../../application/queries/get-readings.query';
import { GetReadingComparisonQuery } from '../../application/queries/get-reading-comparison.query';
import { GetReadingDetailQuery } from '../../application/queries/get-reading-detail.query';

// NOTE: Auth/session validation (null session, missing user.id, getSession throws)
// is tested in session-auth.guard.spec.ts — not duplicated here per DRY principle.

function mockBuses() {
  return { queryBus: { execute: jest.fn() } };
}

describe('MeterController', () => {
  let controller: MeterController;
  let buses: ReturnType<typeof mockBuses>;

  const TEST_USER_ID = 'USR-SESSION-001';

  const mockMeterList = {
    meters: [
      { meterId: 'MT-001', serialNumber: 'SN-001', type: 'mechanical', diameter: 'DN15', accuracyClass: 'Class B', manufactureYear: 2023, installationDate: '2023-06-15', status: 'active' },
      { meterId: 'MT-002', serialNumber: 'SN-002', type: 'ultrasonic', diameter: 'DN20', accuracyClass: 'Class C', manufactureYear: 2024, installationDate: '2024-01-10', status: 'active' },
    ],
    totalCount: 2,
  };

  const mockCalibration = {
    meterId: 'MT-001',
    status: 'expiring_soon',
    isWarning: true,
    lastCalibrationDate: '2024-06-15',
    nextCalibrationDate: '2026-06-15',
    certificateNumber: 'CAL-2024-00123',
  };

  const mockHistory = {
    entries: [
      { eventDate: '2023-06-15', eventType: 'installation', description: 'Installed', performedBy: 'Engineer A' },
    ],
    totalCount: 1,
  };

  const mockReadings = {
    readings: [
      { month: '2025-06', volume: 22, readingDate: '2025-06-30' },
      { month: '2025-05', volume: 18, readingDate: '2025-05-31' },
    ],
    totalCount: 2,
  };

  const mockComparison = {
    currentPeriod: '2025-06',
    previousPeriod: '2025-05',
    currentVolume: 22,
    previousVolume: 18,
    percentageChange: 22.22,
    direction: 'up',
  };

  const mockDetail = {
    period: '2025-06',
    previousIndex: 1247,
    currentIndex: 1269,
    volume: 22,
    evidencePhotos: [
      { url: 'https://storage.ioc.local/photos/001.jpg', caption: 'Meter reading', takenAt: '2025-06-30T09:15:00.000Z' },
    ],
  };

  beforeEach(() => {
    buses = mockBuses();
    controller = new MeterController(buses.queryBus as any);
  });

  // ── GET /meters (AC#1 — returns array) ──────────────────────────────────────

  describe('GET /meters', () => {
    it('should return meter list for authenticated user', async () => {
      buses.queryBus.execute.mockResolvedValue(mockMeterList);

      const result = await controller.getMeters(TEST_USER_ID);

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetMeterByCustomerQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result.meters).toBeInstanceOf(Array);
      expect(result.totalCount).toBe(2);
    });
  });

  // ── GET /meters/:meterId/calibration (AC#2 — isWarning) ─────────────────────

  describe('GET /meters/:meterId/calibration', () => {
    it('should return calibration status with isWarning field', async () => {
      buses.queryBus.execute.mockResolvedValue(mockCalibration);

      const result = await controller.getCalibrationStatus(TEST_USER_ID, 'MT-001');

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetCalibrationStatusQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.meterId).toBe('MT-001');
      expect(result.isWarning).toBe(true);
      expect(result.status).toBe('expiring_soon');
    });
  });

  // ── GET /meters/:meterId/history (AC#3) ─────────────────────────────────────

  describe('GET /meters/:meterId/history', () => {
    it('should return meter history entries', async () => {
      buses.queryBus.execute.mockResolvedValue(mockHistory);

      const result = await controller.getMeterHistory(TEST_USER_ID, 'MT-001');

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetMeterHistoryQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.meterId).toBe('MT-001');
      expect(result.entries).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });
  });

  // ===========================================================================
  // Story 3.1: Consumption History & Charts
  // ===========================================================================

  // ── GET /meters/consumption (Story 3.1 AC#1) ────────────────────────────────

  describe('GET /meters/consumption', () => {
    it('should return 12-month consumption history', async () => {
      buses.queryBus.execute.mockResolvedValue(mockReadings);

      const result = await controller.getConsumptionHistory(TEST_USER_ID);

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetReadingsQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(result.readings).toBeInstanceOf(Array);
      expect(result.totalCount).toBe(2);
    });
  });

  // ── GET /meters/consumption/comparison (Story 3.1 AC#2) ─────────────────────

  describe('GET /meters/consumption/comparison', () => {
    it('should return comparison with percentageChange + direction', async () => {
      buses.queryBus.execute.mockResolvedValue(mockComparison);

      const result = await controller.getConsumptionComparison(TEST_USER_ID, '2025-06', '2025-05');

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetReadingComparisonQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.currentPeriod).toBe('2025-06');
      expect(callArg.previousPeriod).toBe('2025-05');
      expect(result.percentageChange).toBe(22.22);
      expect(result.direction).toBe('up');
    });
  });

  // ── GET /meters/consumption/:period (Story 3.1 AC#3) ────────────────────────

  describe('GET /meters/consumption/:period', () => {
    it('should return reading detail with photos', async () => {
      buses.queryBus.execute.mockResolvedValue(mockDetail);

      const result = await controller.getReadingDetail(TEST_USER_ID, '2025-06');

      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
      const callArg = buses.queryBus.execute.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(GetReadingDetailQuery);
      expect(callArg.customerId).toBe(TEST_USER_ID);
      expect(callArg.period).toBe('2025-06');
      expect(result.period).toBe('2025-06');
      expect(result.evidencePhotos).toHaveLength(1);
    });
  });

  // ── MeterId validation ───────────────────────────────────────────────────────

  describe('MeterId validation', () => {
    it('should throw ValidationException for empty meterId', async () => {
      await expect(controller.getCalibrationStatus(TEST_USER_ID, '')).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for meterId with special characters', async () => {
      await expect(controller.getCalibrationStatus(TEST_USER_ID, 'INV@LID!')).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for meterId exceeding 100 chars', async () => {
      const longId = 'A'.repeat(101);
      await expect(controller.getCalibrationStatus(TEST_USER_ID, longId)).rejects.toThrow(ValidationException);
    });

    it('should accept meterId with dashes', async () => {
      buses.queryBus.execute.mockResolvedValue(mockCalibration);
      await controller.getCalibrationStatus(TEST_USER_ID, 'MT-001');
      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should accept meterId with underscores', async () => {
      buses.queryBus.execute.mockResolvedValue(mockCalibration);
      await controller.getCalibrationStatus(TEST_USER_ID, 'MT_001');
      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should accept meterId with dashes AND underscores', async () => {
      buses.queryBus.execute.mockResolvedValue(mockCalibration);
      await controller.getCalibrationStatus(TEST_USER_ID, 'MT-001_A');
      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
    });
  });

  // ── Period validation (Story 3.1) ────────────────────────────────────────────

  describe('Period validation', () => {
    it('should throw ValidationException for invalid period format (YYYY/MM)', async () => {
      await expect(controller.getReadingDetail(TEST_USER_ID, '2025/06')).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for incomplete period format', async () => {
      await expect(controller.getReadingDetail(TEST_USER_ID, '2025')).rejects.toThrow(ValidationException);
    });

    it('should accept valid YYYY-MM period format', async () => {
      buses.queryBus.execute.mockResolvedValue(mockDetail);
      await controller.getReadingDetail(TEST_USER_ID, '2025-06');
      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
    });
  });

  // ── Comparison params validation (Story 3.1) ────────────────────────────────

  describe('Comparison params validation', () => {
    it('should throw ValidationException for invalid current param', async () => {
      await expect(
        controller.getConsumptionComparison(TEST_USER_ID, 'invalid', '2025-05'),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for invalid previous param', async () => {
      await expect(
        controller.getConsumptionComparison(TEST_USER_ID, '2025-06', 'invalid'),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for both invalid params', async () => {
      await expect(
        controller.getConsumptionComparison(TEST_USER_ID, 'abc', 'xyz'),
      ).rejects.toThrow(ValidationException);
    });

    it('should accept valid YYYY-MM for both params', async () => {
      buses.queryBus.execute.mockResolvedValue(mockComparison);
      await controller.getConsumptionComparison(TEST_USER_ID, '2025-06', '2025-05');
      expect(buses.queryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationException for missing current param (undefined)', async () => {
      await expect(
        controller.getConsumptionComparison(TEST_USER_ID, undefined as any, '2025-05'),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for missing previous param (undefined)', async () => {
      await expect(
        controller.getConsumptionComparison(TEST_USER_ID, '2025-06', undefined as any),
      ).rejects.toThrow(ValidationException);
    });

    it('should throw ValidationException for both params missing', async () => {
      await expect(
        controller.getConsumptionComparison(TEST_USER_ID, undefined as any, undefined as any),
      ).rejects.toThrow(ValidationException);
    });
  });

  // ── Query class type verification ───────────────────────────────────────────

  describe('Query class types', () => {
    it('should dispatch GetMeterByCustomerQuery from GET /meters', async () => {
      buses.queryBus.execute.mockResolvedValue(mockMeterList);
      await controller.getMeters(TEST_USER_ID);
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetMeterByCustomerQuery);
    });

    it('should dispatch GetCalibrationStatusQuery from GET /meters/:id/calibration', async () => {
      buses.queryBus.execute.mockResolvedValue(mockCalibration);
      await controller.getCalibrationStatus(TEST_USER_ID, 'MT-001');
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetCalibrationStatusQuery);
    });

    it('should dispatch GetMeterHistoryQuery from GET /meters/:id/history', async () => {
      buses.queryBus.execute.mockResolvedValue(mockHistory);
      await controller.getMeterHistory(TEST_USER_ID, 'MT-001');
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetMeterHistoryQuery);
    });

    it('should dispatch GetReadingsQuery from GET /meters/consumption', async () => {
      buses.queryBus.execute.mockResolvedValue(mockReadings);
      await controller.getConsumptionHistory(TEST_USER_ID);
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetReadingsQuery);
    });

    it('should dispatch GetReadingComparisonQuery from GET /meters/consumption/comparison', async () => {
      buses.queryBus.execute.mockResolvedValue(mockComparison);
      await controller.getConsumptionComparison(TEST_USER_ID, '2025-06', '2025-05');
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetReadingComparisonQuery);
    });

    it('should dispatch GetReadingDetailQuery from GET /meters/consumption/:period', async () => {
      buses.queryBus.execute.mockResolvedValue(mockDetail);
      await controller.getReadingDetail(TEST_USER_ID, '2025-06');
      expect(buses.queryBus.execute.mock.calls[0][0]).toBeInstanceOf(GetReadingDetailQuery);
    });
  });
});
