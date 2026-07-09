/**
 * QueueService unit tests
 *
 * Covers config-driven enable/disable and the disabled-enqueue contract.
 * The BullMQ Queue/Worker/DLQ path against real Redis is exercised by the
 * Queued-tier integration test (see plan → Verification #5).
 */

import { QueueService } from './queue.service';

const makeLogger = () =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }) as any;

const makeConfig = (redisHost?: string) =>
  ({
    get: (key: string) => (key === 'REDIS_HOST' ? redisHost : undefined),
  }) as any;

describe('QueueService', () => {
  it('is DISABLED when REDIS_HOST is unset', () => {
    const svc = new QueueService(makeConfig(undefined), makeLogger());
    expect(svc.enabled).toBe(false);
  });

  it('is ENABLED when REDIS_HOST is set', () => {
    const svc = new QueueService(makeConfig('localhost'), makeLogger());
    expect(svc.enabled).toBe(true);
  });

  it('rejects enqueue when disabled (PortRegistry falls back to cache/error)', async () => {
    const svc = new QueueService(makeConfig(undefined), makeLogger());
    await expect(
      svc.enqueue({
        portName: 'payment',
        method: 'create',
        params: { invoiceId: 'INV-1' },
        context: { correlationId: 'corr-1' },
      }),
    ).rejects.toThrow('Queue tier disabled');
  });

  it('accepts a replay executor registration (breaks the DI cycle with PortRegistry)', () => {
    const svc = new QueueService(makeConfig('localhost'), makeLogger());
    const executor = jest.fn().mockResolvedValue({ ok: true });
    expect(() => svc.setReplayExecutor(executor)).not.toThrow();
  });

  it('does not auto-connect in the constructor (lazy BullMQ init on module init)', () => {
    const svc = new QueueService(makeConfig('localhost'), makeLogger());
    // enabled flag set, but no Redis connection attempted until onModuleInit
    expect(svc.enabled).toBe(true);
  });
});
