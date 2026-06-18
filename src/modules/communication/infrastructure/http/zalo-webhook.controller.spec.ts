import { ZaloWebhookController } from './zalo-webhook.controller';
import { ZaloSignatureGuard } from '@shared/security';
import { ZaloInboundReceivedEvent } from '../../domain/events/zalo-inbound-received.event';

describe('ZaloWebhookController', () => {
  const outbox = { add: jest.fn().mockResolvedValue(undefined) };
  const idempotency = {
    claim: jest.fn().mockResolvedValue(true),
    check: jest.fn().mockResolvedValue({ hit: false }),
    store: jest.fn(),
  };
  let controller: ZaloWebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ZaloWebhookController(outbox as never, idempotency as never);
  });

  function fakeReq(rawBody: string) {
    return { rawBody } as never;
  }

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should enqueue to the outbox and ack 200 for a new message', async () => {
    const rawBody = JSON.stringify({
      event_name: 'user_send_text',
      sender: { id: 'zalo-user-1' },
      message: { msg_id: 'msg-123', text: 'Mat nuoc khu A' },
    });

    const result = await controller.handleZaloCallback(fakeReq(rawBody));

    expect(result).toEqual({ received: true });
    expect(idempotency.claim).toHaveBeenCalledWith('msg-123');
    expect(outbox.add).toHaveBeenCalledTimes(1);
    const event = outbox.add.mock.calls[0][0] as ZaloInboundReceivedEvent;
    expect(event.eventType).toBe('zalo.inbound');
    expect(event.aggregateId).toBe('msg-123');
    expect(event.data.messageId).toBe('msg-123');
  });

  it('should drop a duplicate (retry) without enqueuing', async () => {
    idempotency.claim.mockResolvedValueOnce(false); // SETNX lost → duplicate
    const rawBody = JSON.stringify({
      sender: { id: 'zalo-user-1' },
      message: { msg_id: 'msg-dup', text: 'hi' },
    });

    const result = await controller.handleZaloCallback(fakeReq(rawBody));

    expect(result).toEqual({ received: true });
    expect(outbox.add).not.toHaveBeenCalled();
  });

  it('should ack 200 but not enqueue when message id is missing', async () => {
    const rawBody = JSON.stringify({ sender: { id: 'zalo-user-1' } }); // no msg_id
    const result = await controller.handleZaloCallback(fakeReq(rawBody));
    expect(result).toEqual({ received: true });
    expect(outbox.add).not.toHaveBeenCalled();
  });

  it('should have @UseGuards(ZaloSignatureGuard) decorator', () => {
    const decorators = Reflect.getMetadata('__guards__', ZaloWebhookController);
    expect(decorators).toBeDefined();
    expect(decorators).toContain(ZaloSignatureGuard);
  });
});
