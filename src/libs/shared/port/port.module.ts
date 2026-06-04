/**
 * Port Module
 *
 * @Global NestJS module providing the Hexagonal Port Registry infrastructure.
 * Imports EndpointConfigModule, caching, resilience, and context modules.
 *
 * AC: all — provides PortRegistry, PortHttpClient, AggregationService to the entire app.
 */

import { Global, Module } from '@nestjs/common';
import { PortRegistry } from './port-registry.service';
import { PortHttpClient } from './port-http-client.service';
import { AggregationService } from './aggregation.service';
import { EndpointConfigModule } from '../endpoint-config/endpoint-config.module';
import { StructuredLogger } from '../observability/structured-logger.service';
import { FallbackProvider } from '../resilience/fallback.provider';

@Global()
@Module({
  imports: [EndpointConfigModule],
  providers: [
    PortRegistry,
    PortHttpClient,
    AggregationService,
    StructuredLogger,
    FallbackProvider,
  ],
  exports: [PortRegistry, PortHttpClient, AggregationService],
})
export class PortModule {}
