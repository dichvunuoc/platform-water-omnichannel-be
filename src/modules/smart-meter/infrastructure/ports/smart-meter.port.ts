import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import { RealtimeConsumptionSchema, SmartMeterStatusSchema } from '../../application/dtos/smart-meter.dto';

/** Smart Meter Port — real-time consumption + device status (Phase 2, S18). */
export interface ISmartMeterPort extends IPortAdapter {
  // Methods: get-realtime-consumption, get-meter-status
}

@Injectable()
export class MockSmartMeterAdapter extends MockAdapterBase implements ISmartMeterPort {
  constructor() {
    super(
      'smart-meter',
      {
        'get-realtime-consumption': RealtimeConsumptionSchema,
        'get-meter-status': SmartMeterStatusSchema,
      },
      new Logger('smart-meter-mock-adapter'),
    );
  }
}
