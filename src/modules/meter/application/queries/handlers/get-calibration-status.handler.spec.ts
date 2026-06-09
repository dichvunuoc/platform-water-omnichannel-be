import { GetCalibrationStatusHandler } from './get-calibration-status.handler';
import { GetCalibrationStatusQuery } from '../get-calibration-status.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';
import type { CalibrationStatusRaw } from '../../dtos/meter.dto';

describe('GetCalibrationStatusHandler', () => {
  let handler: GetCalibrationStatusHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const makeRawResponse = (status: 'valid' | 'expiring_soon' | 'expired'): CalibrationStatusRaw => ({
    meterId: 'MT-001',
    status,
    lastCalibrationDate: '2024-06-15',
    nextCalibrationDate: '2026-06-15',
    certificateNumber: 'CAL-2024-00123',
  });

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetCalibrationStatusHandler(portRegistry);
  });

  // ── isWarning computation (BFF presentation logic) ─────────────────────────

  describe('isWarning computation', () => {
    it('should set isWarning=false when status is valid', async () => {
      portRegistry.execute.mockResolvedValue({
        data: makeRawResponse('valid'),
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      } satisfies PortResult<CalibrationStatusRaw>);

      const result = await handler.execute(new GetCalibrationStatusQuery('USR-12345', 'MT-001'));

      expect(result.isWarning).toBe(false);
      expect(result.status).toBe('valid');
    });

    it('should set isWarning=true when status is expiring_soon', async () => {
      portRegistry.execute.mockResolvedValue({
        data: makeRawResponse('expiring_soon'),
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      } satisfies PortResult<CalibrationStatusRaw>);

      const result = await handler.execute(new GetCalibrationStatusQuery('USR-12345', 'MT-001'));

      expect(result.isWarning).toBe(true);
      expect(result.status).toBe('expiring_soon');
    });

    it('should set isWarning=true when status is expired', async () => {
      portRegistry.execute.mockResolvedValue({
        data: makeRawResponse('expired'),
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      } satisfies PortResult<CalibrationStatusRaw>);

      const result = await handler.execute(new GetCalibrationStatusQuery('USR-12345', 'MT-001'));

      expect(result.isWarning).toBe(true);
      expect(result.status).toBe('expired');
    });
  });

  // ── Port call verification ──────────────────────────────────────────────────

  it('should call portRegistry with correct meterId', async () => {
    portRegistry.execute.mockResolvedValue({
      data: makeRawResponse('valid'),
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    await handler.execute(new GetCalibrationStatusQuery('USR-12345', 'MT-002'));

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'meter',
      'get-calibration-status',
      { customerId: 'USR-12345', meterId: 'MT-002' },
    );
  });

  it('should preserve all raw downstream fields in response', async () => {
    const raw = makeRawResponse('expired');
    portRegistry.execute.mockResolvedValue({
      data: raw,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(new GetCalibrationStatusQuery('USR-12345', 'MT-001'));

    expect(result.meterId).toBe(raw.meterId);
    expect(result.lastCalibrationDate).toBe(raw.lastCalibrationDate);
    expect(result.nextCalibrationDate).toBe(raw.nextCalibrationDate);
    expect(result.certificateNumber).toBe(raw.certificateNumber);
    expect(result.isWarning).toBe(true);
  });
});
