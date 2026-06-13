import { ICommand } from '@core/application';
import type { RecordSessionEventPayload } from '../dtos/session-event.dto';

export class RecordSessionEventCommand implements ICommand {
  constructor(public readonly payload: RecordSessionEventPayload) {}
}
