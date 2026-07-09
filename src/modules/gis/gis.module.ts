import { Module, OnModuleInit } from '@nestjs/common';
import { GisController } from './infrastructure/http/gis.controller';
import { MockGisAdapter } from './infrastructure/ports/gis.port';
import { GIS_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { CheckCoverageHandler } from './application/queries/handlers/check-coverage.handler';
import { GetCustomerLocationHandler } from './application/queries/handlers/get-customer-location.handler';
import { GetNearbyIncidentsHandler } from './application/queries/handlers/get-nearby-incidents.handler';

@Module({
  controllers: [GisController],
  providers: [
    MockGisAdapter,
    { provide: GIS_PORT_TOKEN, useExisting: MockGisAdapter },
    CheckCoverageHandler,
    GetCustomerLocationHandler,
    GetNearbyIncidentsHandler,
  ],
  exports: [GIS_PORT_TOKEN],
})
export class GisModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockGisAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('gis', this.mockAdapter, this.mockAdapter);
  }
}
