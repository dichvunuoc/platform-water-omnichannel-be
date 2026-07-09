import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  ConsumptionReportSchema,
  ComparisonReportSchema,
  GetSavingsTipsResponseSchema,
  DownloadReportResultSchema,
} from '../../application/dtos/reporting.dto';

/**
 * Reporting Port — customer-facing consumption + comparison reports (Phase 2, S23).
 * Cache tier: dynamic.
 */
export interface IReportingPort extends IPortAdapter {
  // Methods: get-consumption-report, get-comparison-report
}

@Injectable()
export class MockReportingAdapter extends MockAdapterBase implements IReportingPort {
  constructor() {
    super(
      'reporting',
      {
        'get-consumption-report': ConsumptionReportSchema,
        'get-comparison-report': ComparisonReportSchema,
        'get-savings-tips': GetSavingsTipsResponseSchema,
        'download-report': DownloadReportResultSchema,
      },
      new Logger('reporting-mock-adapter'),
    );
  }
}
