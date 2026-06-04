import { Global, Module } from '@nestjs/common';
import { EndpointConfigService } from './endpoint-config.service';
import { StructuredLogger } from '../observability/structured-logger.service';

/**
 * Endpoint Config Module
 *
 * Global module providing per-service endpoint configuration.
 * Loads config/api-endpoints.yaml and watches for changes.
 *
 * @Global — used by all domain modules via PortModule.
 */
@Global()
@Module({
  providers: [EndpointConfigService, StructuredLogger],
  exports: [EndpointConfigService],
})
export class EndpointConfigModule {}
