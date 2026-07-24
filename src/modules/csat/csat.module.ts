/** CsatModule — khảo sát hài lòng port. Mock default. */
import { Module } from '@nestjs/common';
import { CSAT_PORT_TOKEN } from '../messaging/constants/cskh-aggregation.tokens';
import { MockCsatAdapter } from '../messaging/infrastructure/adapters/mock/mock-cskh-aggregation.adapters';

@Module({
  providers: [MockCsatAdapter, { provide: CSAT_PORT_TOKEN, useExisting: MockCsatAdapter }],
  exports: [CSAT_PORT_TOKEN],
})
export class CsatModule {}
