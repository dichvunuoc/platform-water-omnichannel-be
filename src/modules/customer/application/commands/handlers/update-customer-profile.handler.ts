/**
 * Update Customer Profile Command Handler (AC#3)
 *
 * Flow:
 * 1. Call downstream to update profile
 * 2. Explicitly invalidate cached profile
 * 3. Re-fetch fresh profile (populates cache with new data)
 * 4. Return fresh profile to frontend
 *
 * Cache key format matches PortRegistry: cache:v2:port:customer-profile:{hash}
 */

import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { PortRegistry } from '@shared/port';
import { CACHE_SERVICE_TOKEN } from '@core/constants/tokens';
import type { ICacheService } from '@shared/caching/cache.interface';
import { generateShortHash } from '@shared/utils/hash.util';
import { UpdateCustomerProfileCommand } from '../update-customer-profile.command';
import type { CustomerProfileResponse, UpdateProfileResponse } from '../../dtos/customer-profile.dto';
import type { PortResult } from '@shared/port/port.interface';

@CommandHandler(UpdateCustomerProfileCommand)
export class UpdateCustomerProfileHandler implements ICommandHandler<UpdateCustomerProfileCommand> {
  private readonly logger = new Logger(UpdateCustomerProfileHandler.name);

  constructor(
    private readonly portRegistry: PortRegistry,
    @Inject(CACHE_SERVICE_TOKEN)
    private readonly cacheService: ICacheService,
  ) {}

  async execute(command: UpdateCustomerProfileCommand): Promise<CustomerProfileResponse> {
    const { customerId, data } = command;

    // 1. Call downstream to update profile
    this.logger.log(`Updating profile for customer: ${customerId}`);
    await this.portRegistry.execute<UpdateProfileResponse>(
      'customer-profile',
      'update-profile',
      { customerId, data },
    );

    // 2. Explicitly invalidate cached profile (Approach A — precise cache key)
    const cacheKey = `cache:v2:port:customer-profile:${generateShortHash(
      JSON.stringify({ method: 'get-profile', params: { customerId } }),
    )}`;
    try {
      await this.cacheService.delete(cacheKey);
      this.logger.log(`Cache invalidated for customer profile: ${customerId}`);
    } catch (error) {
      this.logger.warn(`Cache invalidation failed for ${customerId}: ${(error as Error).message}`);
    }

    // 3. Re-fetch fresh profile (will populate cache via PortRegistry normal flow)
    const freshProfile: PortResult<CustomerProfileResponse> = await this.portRegistry.execute<CustomerProfileResponse>(
      'customer-profile',
      'get-profile',
      { customerId },
    );

    this.logger.log(`Fresh profile fetched for customer: ${customerId}`);
    return freshProfile.data;
  }
}
