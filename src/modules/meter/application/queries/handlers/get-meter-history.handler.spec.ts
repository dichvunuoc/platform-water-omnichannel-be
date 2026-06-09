import { GetMeterHistoryHandler } from './get-meter-history.handler';
import { GetMeterHistoryQuery } from '../get-meter-history.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';
import type { MeterHistoryResponse } from '../../dtos/meter.dto';

describe('GetMeterHistoryHandler', () => {
  let handler: GetMeterHistoryHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockHistoryResponse: MeterHistoryResponse = {
    entries: [
      {
        eventDate: '2023-06-15',
        eventType: 'installation',
        description: 'Initial installation',
        performedBy: 'Engineer A',
      },
      {
        eventDate: '2024-06-15',
        eventType: 'calibration',
        description: 'Annual calibration',
        performedBy: 'Metrology Center',
      },
      {
        eventDate: '2024-08-20',
        eventType: 'replacement',
        description: 'Replaced due to gear fault',
        performedBy: 'Engineer B',
      },
    ],
    totalCount: 3,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn().mockResolvedValue({
        data: mockHistoryResponse,
        adapterUsed: 'mock' as const,
        fromCache: false,
        duration: 10,
      } satisfies PortResult<MeterHistoryResponse>),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetMeterHistoryHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct meterId', async () => {
    const query = new GetMeterHistoryQuery('USR-12345', 'MT-001');
    await handler.execute(query);

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'meter',
      'get-meter-history',
      { customerId: 'USR-12345', meterId: 'MT-001' },
    );
  });

  it('should return history entries with totalCount', async () => {
    const result = await handler.execute(new GetMeterHistoryQuery('USR-12345', 'MT-001'));

    expect(result.entries).toBeInstanceOf(Array);
    expect(result.entries.length).toBe(3);
    expect(result.totalCount).toBe(3);
  });

  it('should return entries with correct event types', async () => {
    const result = await handler.execute(new GetMeterHistoryQuery('USR-12345', 'MT-001'));

    const types = result.entries.map(e => e.eventType);
    expect(types).toContain('installation');
    expect(types).toContain('calibration');
    expect(types).toContain('replacement');
  });

  it('should return empty array when no history', async () => {
    portRegistry.execute.mockResolvedValue({
      data: { entries: [], totalCount: 0 },
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 5,
    });

    const result = await handler.execute(new GetMeterHistoryQuery('USR-12345', 'MT-999'));
    expect(result.entries).toEqual([]);
    expect(result.totalCount).toBe(0);
  });
});
