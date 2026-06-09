import { GetReadingDetailHandler } from './get-reading-detail.handler';
import { GetReadingDetailQuery } from '../get-reading-detail.query';
import type { PortRegistry } from '@shared/port/port-registry.service';
import type { PortResult } from '@shared/port/port.interface';
import type { ReadingDetail } from '../../dtos/meter-reading.dto';

describe('GetReadingDetailHandler', () => {
  let handler: GetReadingDetailHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  const mockDetail: ReadingDetail = {
    period: '2025-06',
    previousIndex: 1247,
    currentIndex: 1269,
    volume: 22,
    evidencePhotos: [
      {
        url: 'https://storage.ioc.local/photos/meter/DNG-2024-0001/2025-06-30-001.jpg',
        caption: 'Chỉ số đồng hồ nước — cuối kỳ',
        takenAt: '2025-06-30T09:15:00.000Z',
      },
    ],
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetReadingDetailHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockDetail,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const query = new GetReadingDetailQuery('USR-001', '2025-06');
    const result = await handler.execute(query);

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'meter-reading',
      'get-reading-detail',
      { customerId: 'USR-001', period: '2025-06' },
    );
    expect(result).toEqual(mockDetail);
  });

  it('should return reading detail with meter indices', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockDetail,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(new GetReadingDetailQuery('USR-001', '2025-06'));

    expect(result.period).toBe('2025-06');
    expect(result.previousIndex).toBe(1247);
    expect(result.currentIndex).toBe(1269);
    expect(result.volume).toBe(22);
  });

  it('should return evidence photos', async () => {
    portRegistry.execute.mockResolvedValue({
      data: mockDetail,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 10,
    });

    const result = await handler.execute(new GetReadingDetailQuery('USR-001', '2025-06'));

    expect(result.evidencePhotos).toHaveLength(1);
    expect(result.evidencePhotos[0].url).toBeDefined();
    expect(result.evidencePhotos[0].caption).toBe('Chỉ số đồng hồ nước — cuối kỳ');
  });

  it('should handle detail with empty evidence photos', async () => {
    const noPhotos: ReadingDetail = {
      period: '2025-01',
      previousIndex: 1000,
      currentIndex: 1014,
      volume: 14,
      evidencePhotos: [],
    };
    portRegistry.execute.mockResolvedValue({
      data: noPhotos,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 5,
    });

    const result = await handler.execute(new GetReadingDetailQuery('USR-001', '2025-01'));

    expect(result.evidencePhotos).toHaveLength(0);
  });
});
