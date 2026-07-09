import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  QualityAtLocationSchema,
  QualityAlertsResponseSchema,
} from '../../application/dtos/water-quality.dto';

/** Water Quality Port — quality at location + alerts (Phase 3, S35). */
export interface IWaterQualityPort extends IPortAdapter {
  // Methods: get-quality-at-location, get-quality-alerts
}

@Injectable()
export class MockWaterQualityAdapter extends MockAdapterBase implements IWaterQualityPort {
  constructor() {
    super(
      'water-quality',
      {
        'get-quality-at-location': QualityAtLocationSchema,
        'get-quality-alerts': QualityAlertsResponseSchema,
      },
      new Logger('water-quality-mock-adapter'),
    );
  }
}
