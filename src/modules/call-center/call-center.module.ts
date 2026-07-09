import { Module, OnModuleInit } from '@nestjs/common';
import { CallCenterController } from './infrastructure/http/call-center.controller';
import { MockCallCenterAdapter } from './infrastructure/ports/call-center.port';
import { CALL_CENTER_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { CreateClickToCallHandler } from './application/commands/handlers/create-click-to-call.handler';
import { GetCallHistoryHandler } from './application/queries/handlers/get-call-history.handler';

@Module({
  controllers: [CallCenterController],
  providers: [
    MockCallCenterAdapter,
    { provide: CALL_CENTER_PORT_TOKEN, useExisting: MockCallCenterAdapter },
    CreateClickToCallHandler,
    GetCallHistoryHandler,
  ],
  exports: [CALL_CENTER_PORT_TOKEN],
})
export class CallCenterModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockCallCenterAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('call-center', this.mockAdapter, this.mockAdapter);
  }
}
