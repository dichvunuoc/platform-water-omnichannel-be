import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ICustomer360Port,
  CustomerProfile,
} from './customer-360.port';

/**
 * Customer 360 BFF adapter — lấy profile qua .NET `water-business-cskh-bff`
 * (không gọi customer service trực tiếp). Config-gated bởi `CSKH_BFF_URL`.
 *
 - set → HTTP GET `/api/cskh/customers/{id}` (+ `/resolve?channel=&customerChannelId=`)
 - unset → trả null (fallback về MockCustomer360Adapter qua factory)
 *
 - Field map: cskh-bff trả `custType` → omichannel_be `customerType`.
 */
@Injectable()
export class Customer360BffAdapter implements ICustomer360Port {
  private readonly logger = new Logger('customer-360-bff-adapter');
  private readonly bffUrl?: string;

  constructor(config: ConfigService) {
    this.bffUrl = config.get<string>('CSKH_BFF_URL');
    if (this.bffUrl) this.logger.log(`Customer360 → ${this.bffUrl}`);
  }

  async getProfile(customerId: string): Promise<CustomerProfile | null> {
    if (!this.bffUrl) return null;
    return this.fetchProfile(
      `${this.bffUrl}/api/cskh/customers/${encodeURIComponent(customerId)}`,
    );
  }

  async resolveIdentity(
    channel: string,
    customerChannelId: string,
  ): Promise<CustomerProfile | null> {
    if (!this.bffUrl) return null;
    const qs = `?channel=${encodeURIComponent(channel)}&customerChannelId=${encodeURIComponent(customerChannelId)}`;
    return this.fetchProfile(`${this.bffUrl}/api/cskh/customers/resolve${qs}`);
  }

  private async fetchProfile(url: string): Promise<CustomerProfile | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = (await res.json()) as {
        success?: boolean;
        data?: BffCustomerProfile;
      } | null;
      const d = json?.data;
      if (!d) return null;
      return {
        id: d.id,
        name: d.name,
        phone: d.phone,
        address: d.address,
        contract: d.contract,
        customerType: d.custType, // cskh-bff custType → omichannel_be customerType
      };
    } catch (e) {
      this.logger.warn(`Customer360 fetch failed: ${(e as Error).message}`);
      return null;
    }
  }
}

interface BffCustomerProfile {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  phuong?: string;
  custType?: string;
  contract?: string;
}
