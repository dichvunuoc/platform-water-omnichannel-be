import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { LeakageAlertsResponseSchema, LeakageDetailSchema, ScheduleInspectionResultSchema, InspectionResultSchema } from '../../application/dtos/leakage-alert.dto';

/** Leakage Alert Port — AI water-leakage detection (Phase 3, S25). */
export interface ILeakageAlertPort extends IPortAdapter {
  // Methods: get-leakage-alerts, get-leakage-detail
}

@Injectable()
export class MockLeakageAlertAdapter extends MockAdapterBase implements ILeakageAlertPort {
  constructor() {
    super(
      'leakage-alert',
      {
        'get-leakage-alerts': LeakageAlertsResponseSchema,
        'get-leakage-detail': LeakageDetailSchema,
        'schedule-inspection': ScheduleInspectionResultSchema,
        'get-inspection-result': InspectionResultSchema,
      },
      new Logger('leakage-alert-mock-adapter'),
    );
  }
}
