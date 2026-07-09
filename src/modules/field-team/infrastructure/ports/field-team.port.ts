import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { TeamEtaSchema, TeamLocationSchema } from '../../application/dtos/field-team.dto';

/** Field Team Port — live ETA + location tracking (Phase 2, S31, Grab-style). */
export interface IFieldTeamPort extends IPortAdapter {
  // Methods: get-team-eta, get-team-location
}

@Injectable()
export class MockFieldTeamAdapter extends MockAdapterBase implements IFieldTeamPort {
  constructor() {
    super(
      'field-team',
      {
        'get-team-eta': TeamEtaSchema,
        'get-team-location': TeamLocationSchema,
      },
      new Logger('field-team-mock-adapter'),
    );
  }
}
