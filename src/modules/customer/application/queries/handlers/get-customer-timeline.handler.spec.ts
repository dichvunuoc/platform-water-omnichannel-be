import { GetCustomerTimelineHandler } from './get-customer-timeline.handler';
import { GetCustomerTimelineQuery, TimelineFilters } from '../get-customer-timeline.query';
import { PortRegistry } from '@shared/port';

describe('GetCustomerTimelineHandler', () => {
  let handler: GetCustomerTimelineHandler;
  let portRegistry: jest.Mocked<PortRegistry>;

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<PortRegistry>;

    handler = new GetCustomerTimelineHandler(portRegistry);
  });

  it('should call portRegistry.execute with correct params and no filters', async () => {
    const mockTimeline = {
      entries: [
        {
          eventType: 'invoice_issued',
          timestamp: '2024-01-01T00:00:00.000Z',
          summary: 'Test invoice',
          channel: null,
          referenceId: 'INV-001',
        },
      ],
      totalCount: 1,
    };

    portRegistry.execute.mockResolvedValue({
      data: mockTimeline,
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 8,
    });

    const query = new GetCustomerTimelineQuery('USR-001');
    const result = await handler.execute(query);

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'customer-profile',
      'get-timeline',
      { customerId: 'USR-001', filters: undefined },
    );
    expect(result).toEqual(mockTimeline);
    expect(result.entries).toHaveLength(1);
  });

  it('should pass filters to portRegistry.execute', async () => {
    const filters: TimelineFilters = {
      eventType: 'invoice_issued',
      channel: 'web',
    };

    portRegistry.execute.mockResolvedValue({
      data: { entries: [], totalCount: 0 },
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 3,
    });

    const query = new GetCustomerTimelineQuery('USR-001', filters);
    await handler.execute(query);

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'customer-profile',
      'get-timeline',
      { customerId: 'USR-001', filters },
    );
  });

  it('should pass date range filters', async () => {
    const filters: TimelineFilters = {
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-12-31T23:59:59.000Z',
    };

    portRegistry.execute.mockResolvedValue({
      data: { entries: [], totalCount: 0 },
      adapterUsed: 'mock' as const,
      fromCache: false,
      duration: 2,
    });

    const query = new GetCustomerTimelineQuery('USR-001', filters);
    await handler.execute(query);

    expect(portRegistry.execute).toHaveBeenCalledWith(
      'customer-profile',
      'get-timeline',
      { customerId: 'USR-001', filters },
    );
  });
});
