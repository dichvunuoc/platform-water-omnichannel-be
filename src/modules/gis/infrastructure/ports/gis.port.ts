import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  CoverageResultSchema,
  GetCustomerLocationResponseSchema,
  GetNearbyIncidentsResponseSchema,
} from '../../application/dtos/gis.dto';

/**
 * GIS Port — coverage check + customer location (Phase 2, S30).
 * Cache tier: static.
 */
export interface IGISPort extends IPortAdapter {
  // Methods: check-coverage, get-customer-location
}

@Injectable()
export class MockGisAdapter extends MockAdapterBase implements IGISPort {
  constructor() {
    super(
      'gis',
      {
        'check-coverage': CoverageResultSchema,
        'get-customer-location': GetCustomerLocationResponseSchema,
        'get-nearby-incidents': GetNearbyIncidentsResponseSchema,
      },
      new Logger('gis-mock-adapter'),
    );
  }
}
