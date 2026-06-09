import { GetReadingsHandler } from './get-readings.handler';
import { GetReadingsQuery } from '../get-readings.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';
import type { ReadingsListResponse } from '../../dtos/meter-reading.dto';

describe('GetReadingsHandler', () => {
  let handler: GetReadingsHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockReadingsList: ReadingsListResponse = {
    readings: [
      { month: '2025-06', volume: 22, readingDate: '2025-06-30' },
      { month: '2025-05', volume: 18, readingDate: '2025-05-31' },
    ],
    totalCount: 2,
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetReadingsHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockReadingsList,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const query = new GetReadingsQuery('USR-001');
    const result = await handler.execute(query);

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'meter-reading',
      'get-readings',
      { customerId: 'USR-001' },
    );
    expect(result).toEqual(mockReadingsList);
    expect(result.readings).toHaveLength(2);
    expect(result.totalCount).toBe(2);
  });

  it('should return readings with correct month format', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockReadingsList,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(new GetReadingsQuery('USR-001'));

    expect(result.readings[0].month).toBe('2025-06');
    expect(result.readings[0].volume).toBe(22);
  });

  it('should handle empty readings list', async () => {
    const emptyList: ReadingsListResponse = { readings: [], totalCount: 0 };
    portRegistry.execute.mockResolvedValue({
      data: emptyList,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 5,
    });

    const result = await handler.execute(new GetReadingsQuery('USR-001'));

    expect(result.readings).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });
});
