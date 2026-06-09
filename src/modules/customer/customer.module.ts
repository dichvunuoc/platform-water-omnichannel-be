/**
 * Customer Module
 *
 * NestJS module for customer profile operations.
 * Registers MockCustomerProfileAdapter with PortRegistry via onModuleInit.
 *
 * Pattern: AuthModule → domain modules → AuthPropagationModule → PortModule
 * This module goes after AuthModule, before AuthPropagationModule in AppModule.
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { CustomerController } from './infrastructure/http/customer.controller';
import { MockCustomerProfileAdapter } from './infrastructure/ports/customer-profile.port';
import { CUSTOMER_PROFILE_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetCustomerProfileHandler } from './application/queries/handlers/get-customer-profile.handler';
import { GetCustomerTimelineHandler } from './application/queries/handlers/get-customer-timeline.handler';
import { GetRelatedAccountsHandler } from './application/queries/handlers/get-related-accounts.handler';
import { UpdateCustomerProfileHandler } from './application/commands/handlers/update-customer-profile.handler';

@Module({
  controllers: [CustomerController],
  providers: [
    // Port Adapter (single instance shared via useExisting)
    MockCustomerProfileAdapter,
    {
      provide: CUSTOMER_PROFILE_PORT_TOKEN,
      useExisting: MockCustomerProfileAdapter,
    },
    // CQRS Query Handlers
    GetCustomerProfileHandler,
    GetCustomerTimelineHandler,
    GetRelatedAccountsHandler,
    // CQRS Command Handlers
    UpdateCustomerProfileHandler,
  ],
  exports: [CUSTOMER_PROFILE_PORT_TOKEN],
})
export class CustomerModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockCustomerProfileAdapter,
  ) {}

  /**
   * Register port with PortRegistry on module init.
   * Config merges from api-endpoints.yaml (customer-profile entry built in Story 1.1).
   */
  onModuleInit() {
    this.portRegistry.register(
      'customer-profile',
      this.mockAdapter, // mock adapter
      this.mockAdapter, // live adapter (mock until Backend available)
    );
  }
}
