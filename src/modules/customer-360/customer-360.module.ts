/**
 * Customer360Module — kết nối customer profile qua Customer BFF (.NET cskh-bff).
 * Mock default, Bff adapter khi CSKH_BFF_URL set. Export CUSTOMER_360_PORT_TOKEN.
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CUSTOMER_360_PORT_TOKEN } from './customer-360.tokens';
import { MockCustomer360Adapter } from './mock-customer-360.adapter';
import { Customer360BffAdapter } from './customer-360-bff.adapter';
import { IdentityResolutionHandler } from './identity-resolution.handler';

@Module({
  providers: [
    MockCustomer360Adapter,
    Customer360BffAdapter,
    IdentityResolutionHandler,
    {
      provide: CUSTOMER_360_PORT_TOKEN,
      useFactory: (
        config: ConfigService,
        mock: MockCustomer360Adapter,
        bff: Customer360BffAdapter,
      ) => (config.get<string>('CSKH_BFF_URL') ? bff : mock),
      inject: [ConfigService, MockCustomer360Adapter, Customer360BffAdapter],
    },
  ],
  exports: [CUSTOMER_360_PORT_TOKEN],
})
export class Customer360Module {}
