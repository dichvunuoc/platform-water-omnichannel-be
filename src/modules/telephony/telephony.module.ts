/** TelephonyModule — tổng đài/softphone port (→ telephony/PBX). Mock default. */
import { Module } from '@nestjs/common';
import { TELEPHONY_PORT_TOKEN, MockTelephonyAdapter } from './telephony.adapter';

@Module({
  providers: [MockTelephonyAdapter, { provide: TELEPHONY_PORT_TOKEN, useExisting: MockTelephonyAdapter }],
  exports: [TELEPHONY_PORT_TOKEN],
})
export class TelephonyModule {}
