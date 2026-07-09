import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  GetSegmentsResponseSchema,
  CheckEligibilityResponseSchema,
  GetSegmentHistoryResponseSchema,
} from '../../application/dtos/segmentation.dto';

/**
 * Segmentation Port — customer segmentation + campaign eligibility (Phase 2, S3).
 * Cache tier: static (segment rarely changes).
 */
export interface ISegmentationPort extends IPortAdapter {
  // Methods: get-segments, check-eligibility
}

@Injectable()
export class MockSegmentationAdapter extends MockAdapterBase implements ISegmentationPort {
  constructor() {
    super(
      'segmentation',
      {
        'get-segments': GetSegmentsResponseSchema,
        'check-eligibility': CheckEligibilityResponseSchema,
        'get-segment-history': GetSegmentHistoryResponseSchema,
      },
      new Logger('segmentation-mock-adapter'),
    );
  }
}
