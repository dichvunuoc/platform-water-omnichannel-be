import { Module, OnModuleInit } from '@nestjs/common';
import { EcontractController } from './infrastructure/http/econtract.controller';
import { MockEcontractAdapter } from './infrastructure/ports/econtract.port';
import { ECONTRACT_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetContractHandler } from './application/queries/handlers/get-contract.handler';
import { SignContractHandler } from './application/commands/handlers/sign-contract.handler';

@Module({
  controllers: [EcontractController],
  providers: [
    MockEcontractAdapter,
    { provide: ECONTRACT_PORT_TOKEN, useExisting: MockEcontractAdapter },
    GetContractHandler,
    SignContractHandler,
  ],
  exports: [ECONTRACT_PORT_TOKEN],
})
export class EcontractModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockEcontractAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('econtract', this.mockAdapter, this.mockAdapter);
  }
}
