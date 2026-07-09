import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { EcontractResponseSchema, SignContractResultSchema } from '../../application/dtos/econtract.dto';

/** e-Contract Port — digital contract retrieval + e-signature (Phase 2, S15). */
export interface IeContractPort extends IPortAdapter {
  // Methods: get-contract, sign-contract
}

@Injectable()
export class MockEcontractAdapter extends MockAdapterBase implements IeContractPort {
  constructor() {
    super(
      'econtract',
      {
        'get-contract': EcontractResponseSchema,
        'sign-contract': SignContractResultSchema,
      },
      new Logger('econtract-mock-adapter'),
    );
  }
}
