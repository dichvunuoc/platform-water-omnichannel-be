import { Injectable, Logger } from '@nestjs/common';
import type {
  ICustomer360Port,
  CustomerProfile,
  IdentityResolutionResult,
} from '../../../domain/ports/customer-360.port';

/**
 * Mock Customer 360 Adapter (wave-1)
 *
 * Returns static Vietnamese customer profiles simulating the real
 * Customer 360 service. Used for demo (J1 journey: "Nguyễn Văn Nam").
 */
@Injectable()
export class MockCustomer360Adapter implements ICustomer360Port {
  private readonly logger = new Logger(MockCustomer360Adapter.name);

  private readonly mockProfiles: Map<string, CustomerProfile> = new Map([
    ['zalo-user-bac-nam', {
      id: 'cust-001',
      name: 'Nguyễn Văn Nam',
      phone: '0908 215 770',
      address: '128 Lê Lợi, P. Hòa Bình',
      contract: 'HD-2024-0001',
      receivables: '0 VND',
      consumption: '32 m³/tháng',
      customerType: 'Hộ gia đình',
    }],
    ['zalo-user-chi-hoa', {
      id: 'cust-002',
      name: 'Trần Thị Hoa',
      phone: '0903 456 789',
      address: '45 Nguyễn Huệ, P. Lê Lợi',
      contract: 'HD-2024-0042',
      receivables: '125.000 VND',
      consumption: '48 m³/tháng (↑ 3x so với tháng trước)',
      customerType: 'Hộ gia đình',
    }],
    ['app-user-001', {
      id: 'cust-003',
      name: 'Anh Khang',
      phone: '0912 345 678',
      address: '78 Trần Hưng Đạo',
      contract: 'HD-2023-0156',
      receivables: '0 VND',
      consumption: '18 m³/tháng',
      customerType: 'Hộ gia đình',
    }],
  ]);

  async resolveIdentity(channel: string, customerChannelId: string): Promise<CustomerProfile | null> {
    this.logger.debug(`Mock resolveIdentity: ${channel}/${customerChannelId}`);

    const profile = this.mockProfiles.get(customerChannelId);
    if (profile) {
      this.logger.log(`Identity resolved: ${customerChannelId} → ${profile.name} (${profile.id})`);
      return profile;
    }

    this.logger.warn(`Identity NOT resolved: ${customerChannelId}`);
    return null;
  }

  async getProfile(customerId: string): Promise<CustomerProfile | null> {
    for (const profile of this.mockProfiles.values()) {
      if (profile.id === customerId) return profile;
    }
    return null;
  }

  /**
   * Identity resolution with fallback (FR30).
   * Returns the resolution result including a fallback action for unknown customers.
   */
  async resolveWithFallback(channel: string, customerChannelId: string): Promise<IdentityResolutionResult> {
    const profile = await this.resolveIdentity(channel, customerChannelId);
    if (profile) {
      return { resolved: true, customer: profile };
    }

    return {
      resolved: false,
      fallbackAction: 'PROVISIONAL_PROFILE',
    };
  }
}
