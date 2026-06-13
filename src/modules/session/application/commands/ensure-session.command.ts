import { ICommand } from '@core/application';
import type { ChannelType } from '../../domain/events/session-event.types';

export class EnsureSessionCommand implements ICommand {
  constructor(
    public readonly userId: string,
    public readonly channel: ChannelType,
  ) {}
}
