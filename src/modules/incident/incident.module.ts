/** IncidentModule — sự cố hiện trường port (→ incident-service). Mock default. */
import { Module } from '@nestjs/common';
import { INCIDENT_PORT_TOKEN } from '../messaging/constants/cskh-aggregation.tokens';
import { MockIncidentAdapter } from '../messaging/infrastructure/adapters/mock/mock-cskh-aggregation.adapters';

@Module({
  providers: [MockIncidentAdapter, { provide: INCIDENT_PORT_TOKEN, useExisting: MockIncidentAdapter }],
  exports: [INCIDENT_PORT_TOKEN],
})
export class IncidentModule {}
