import { Module, OnModuleInit } from '@nestjs/common';
import { FieldTeamController } from './infrastructure/http/field-team.controller';
import { MockFieldTeamAdapter } from './infrastructure/ports/field-team.port';
import { FIELD_TEAM_PORT_TOKEN } from './constants/tokens';
import { PortRegistry } from '@shared/port';
import { GetTeamEtaHandler } from './application/queries/handlers/get-team-eta.handler';
import { GetTeamLocationHandler } from './application/queries/handlers/get-team-location.handler';

@Module({
  controllers: [FieldTeamController],
  providers: [
    MockFieldTeamAdapter,
    { provide: FIELD_TEAM_PORT_TOKEN, useExisting: MockFieldTeamAdapter },
    GetTeamEtaHandler,
    GetTeamLocationHandler,
  ],
  exports: [FIELD_TEAM_PORT_TOKEN],
})
export class FieldTeamModule implements OnModuleInit {
  constructor(
    private readonly portRegistry: PortRegistry,
    private readonly mockAdapter: MockFieldTeamAdapter,
  ) {}

  onModuleInit() {
    this.portRegistry.register('field-team', this.mockAdapter, this.mockAdapter);
  }
}
