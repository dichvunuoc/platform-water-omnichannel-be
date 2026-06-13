import { ZaloWebhookController } from './zalo-webhook.controller';
import { ZaloSignatureGuard } from '@shared/security';

describe('ZaloWebhookController', () => {
  let controller: ZaloWebhookController;

  beforeEach(() => {
    controller = new ZaloWebhookController();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return { received: true } on handleZaloCallback', async () => {
    const result = await controller.handleZaloCallback({ event: 'message.send' });
    expect(result).toEqual({ received: true });
  });

  it('should have @UseGuards(ZaloSignatureGuard) decorator', () => {
    // Verify the controller class has the guard applied
    const decorators = Reflect.getMetadata('__guards__', ZaloWebhookController);
    expect(decorators).toBeDefined();
    expect(decorators).toContain(ZaloSignatureGuard);
  });
});
