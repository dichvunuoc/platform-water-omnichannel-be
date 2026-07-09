import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PortRegistry } from '@shared/port';
import { PortFallbackException } from '@shared/port/port-exceptions';
import { GetSavingsTipsQuery, GetSavingsTipsResult } from '../get-savings-tips.query';
import type { GetSavingsTipsResponse } from '../../dtos/reporting.dto';

@QueryHandler(GetSavingsTipsQuery)
export class GetSavingsTipsHandler implements IQueryHandler<GetSavingsTipsQuery> {
  constructor(private readonly portRegistry: PortRegistry) {}

  async execute(query: GetSavingsTipsQuery): Promise<GetSavingsTipsResult> {
    const result = await this.portRegistry.execute<GetSavingsTipsResponse>(
      'reporting',
      'get-savings-tips',
      { customerId: query.customerId },
    );
    if (!result?.data) throw new PortFallbackException('reporting');
    return result.data;
  }
}
