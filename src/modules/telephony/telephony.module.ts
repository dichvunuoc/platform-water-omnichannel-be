/** TelephonyModule — tổng đài/softphone port (→ telephony/PBX). Mock default. */
import { Module } from '@nestjs/common';
import { TELEPHONY_PORT_TOKEN } from '../messaging/constants/cskh-aggregation.tokens';
import { MockTelephonyAdapter } from '../messaging/infrastructure/adapters/mock/mock-cskh-aggregation.adapters';

@Module({
  providers: [MockTelephonyAdapter, { provide: TELEPHONY_PORT_TOKEN, useExisting: MockTelephonyAdapter }],
  exports: [TELEPHONY_PORT_TOKEN],
})
export class TelephonyModule {}
