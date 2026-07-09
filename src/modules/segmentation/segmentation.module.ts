import { Module, OnModuleInit } from '@nestjs/common';
import { SegmentationController } from './infrastructure/http/segmentation.controller';
import { MockSegmentationAdapter } from './infrastructure/ports/segmentation.port';
import { SEGMENTATION_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetSegmentsHandler } from './application/queries/handlers/get-segments.handler';
import { CheckEligibilityHandler } from './application/queries/handlers/check-eligibility.handler';
import { GetSegmentHistoryHandler } from './application/queries/handlers/get-segment-history.handler';

@Module({
  controllers: [SegmentationController],
  providers: [
    MockSegmentationAdapter,
    { provide: SEGMENTATION_PORT_TOKEN, useExisting: MockSegmentationAdapter },
    GetSegmentsHandler,
    CheckEligibilityHandler,
    GetSegmentHistoryHandler,
  ],
  exports: [SEGMENTATION_PORT_TOKEN],
})
export class SegmentationModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockSegmentationAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('segmentation', this.mockAdapter, this.mockAdapter);
  }
}
