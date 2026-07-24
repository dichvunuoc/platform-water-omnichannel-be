/** CsatModule — khảo sát hài lòng port. Mock default. */
import { Module } from '@nestjs/common';
import { CSAT_PORT_TOKEN, MockCsatAdapter } from './csat.adapter';

@Module({
  providers: [MockCsatAdapter, { provide: CSAT_PORT_TOKEN, useExisting: MockCsatAdapter }],
  exports: [CSAT_PORT_TOKEN],
})
export class CsatModule {}
