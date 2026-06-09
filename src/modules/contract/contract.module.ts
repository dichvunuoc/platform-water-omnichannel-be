/**
 * Contract Module
 *
 * NestJS module for contract operations.
 * Registers MockContractAdapter with PortRegistry via onModuleInit.
 *
 * Pattern: AuthModule → CustomerModule → ContractModule → AuthPropagationModule → PortModule
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { ContractController } from './infrastructure/http/contract.controller';
import { MockContractAdapter } from './infrastructure/ports/contract.port';
import { CONTRACT_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetContractsHandler } from './application/queries/handlers/get-contracts.handler';
import { GetContractDetailHandler } from './application/queries/handlers/get-contract-detail.handler';
import { GetContractVersionsHandler } from './application/queries/handlers/get-contract-versions.handler';
import { GetContractPDFHandler } from './application/queries/handlers/get-contract-pdf.handler';

@Module({
  controllers: [ContractController],
  providers: [
    // Port Adapter (single instance shared via useExisting)
    MockContractAdapter,
    {
      provide: CONTRACT_PORT_TOKEN,
      useExisting: MockContractAdapter,
    },
    // CQRS Query Handlers
    GetContractsHandler,
    GetContractDetailHandler,
    GetContractVersionsHandler,
    GetContractPDFHandler,
  ],
  exports: [CONTRACT_PORT_TOKEN],
})
export class ContractModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockContractAdapter,
  ) {}

  /**
   * Register port with PortRegistry on module init.
   * Config merges from api-endpoints.yaml (contract entry built in Story 1.1).
   */
  onModuleInit() {
    this.portRegistry.register(
      'contract',
      this.mockAdapter, // mock adapter
      this.mockAdapter, // live adapter (mock until Backend available)
    );
  }
}
