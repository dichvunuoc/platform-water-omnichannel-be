/** FieldTeamModule — field-team dispatch port (FR62 — Epic 7). Mock default. */
import { Module } from '@nestjs/common';
import { MockFieldTeamAdapter } from './mock-field-team.adapter';
import { FIELD_TEAM_PORT_TOKEN } from './field-team.tokens';

@Module({
  providers: [MockFieldTeamAdapter, { provide: FIELD_TEAM_PORT_TOKEN, useExisting: MockFieldTeamAdapter }],
  exports: [FIELD_TEAM_PORT_TOKEN],
})
export class FieldTeamModule {}
