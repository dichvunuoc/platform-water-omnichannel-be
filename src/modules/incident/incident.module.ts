/** IncidentModule — sự cố hiện trường port (→ incident-service). Mock default. */
import { Module } from '@nestjs/common';
import { INCIDENT_PORT_TOKEN, MockIncidentAdapter } from './incident.adapter';

@Module({
  providers: [
    MockIncidentAdapter,
    { provide: INCIDENT_PORT_TOKEN, useExisting: MockIncidentAdapter },
  ],
  exports: [INCIDENT_PORT_TOKEN],
})
export class IncidentModule {}
