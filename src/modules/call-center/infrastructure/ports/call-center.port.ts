import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { ClickToCallResultSchema, CallHistorySchema } from '../../application/dtos/call-center.dto';

/** Call Center Port — click-to-call (App → hotline) + call history (Phase 2, S29). */
export interface ICallCenterPort extends IPortAdapter {
  // Methods: create-click-to-call, get-call-history
}

@Injectable()
export class MockCallCenterAdapter extends MockAdapterBase implements ICallCenterPort {
  constructor() {
    super(
      'call-center',
      {
        'create-click-to-call': ClickToCallResultSchema,
        'get-call-history': CallHistorySchema,
      },
      new Logger('call-center-mock-adapter'),
    );
  }
}
