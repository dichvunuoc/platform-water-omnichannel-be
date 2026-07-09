import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { UpdateMarketingPreferenceCommand, UpdateMarketingPreferenceResultType } from '../update-marketing-preference.command';
import type { MarketingPreferenceResult } from '../../dtos/campaign.dto';

@CommandHandler(UpdateMarketingPreferenceCommand)
export class UpdateMarketingPreferenceHandler implements ICommandHandler<UpdateMarketingPreferenceCommand> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(command: UpdateMarketingPreferenceCommand): Promise<UpdateMarketingPreferenceResultType> {
    const result = await this.portRegistry.execute<MarketingPreferenceResult>(
      'campaign',
      'update-marketing-preference',
      { customerId: command.customerId, channels: command.channels, useCache: false },
    );
    if (!result?.data) throw new PortFallbackException('campaign');
    return result.data;
  }
}
