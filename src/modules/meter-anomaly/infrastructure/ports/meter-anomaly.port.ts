import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { AnomalyAlertsResponseSchema, AnomalyDetailSchema, ReportAnomalyStatusResultSchema } from '../../application/dtos/meter-anomaly.dto';

/** Meter Anomaly Port — AI-detected meter anomalies (Phase 3, S27). */
export interface IMeterAnomalyPort extends IPortAdapter {
  // Methods: get-anomaly-alerts, get-anomaly-detail
}

@Injectable()
export class MockMeterAnomalyAdapter extends MockAdapterBase implements IMeterAnomalyPort {
  constructor() {
    super(
      'meter-anomaly',
      {
        'get-anomaly-alerts': AnomalyAlertsResponseSchema,
        'get-anomaly-detail': AnomalyDetailSchema,
        'report-anomaly-status': ReportAnomalyStatusResultSchema,
      },
      new Logger('meter-anomaly-mock-adapter'),
    );
  }
}
