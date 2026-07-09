import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { CutoffStatusSchema, CutoffScheduleSchema } from '../../application/dtos/water-cutoff.dto';

/** Water Cutoff Port — non-payment cutoff status + area schedule (Phase 2, S17). */
export interface IWaterCutoffPort extends IPortAdapter {
  // Methods: get-cutoff-status, get-cutoff-schedule
}

@Injectable()
export class MockWaterCutoffAdapter extends MockAdapterBase implements IWaterCutoffPort {
  constructor() {
    super(
      'water-cutoff',
      {
        'get-cutoff-status': CutoffStatusSchema,
        'get-cutoff-schedule': CutoffScheduleSchema,
      },
      new Logger('water-cutoff-mock-adapter'),
    );
  }
}
