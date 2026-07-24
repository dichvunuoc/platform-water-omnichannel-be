/**
 * Customer Identity Port (FR28) — resolve a channel-side id to a unified customer profile.
 * Consumed from the Customer 360 service (mock wave-1 → real wave-3).
 */
export interface ICustomer360Port {
  /** Resolve a channel identifier to a global customer profile. */
  resolveIdentity(channel: string, customerChannelId: string): Promise<CustomerProfile | null>;

  /** Fetch full profile by global customer ID. */
  getProfile(customerId: string): Promise<CustomerProfile | null>;
}

/**
 * Customer 360 profile (FR29) — displayed in the BFF conversation view.
 */
export interface CustomerProfile {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  contract?: string;
  receivables?: string;
  consumption?: string;
  customerType?: string;
}

/**
 * Identity resolution result (FR30 — fallback for unknown customers).
 */
export interface IdentityResolutionResult {
  resolved: boolean;
  customer?: CustomerProfile;
  /** Suggested next step for unresolved customers. */
  fallbackAction?: 'PROVISIONAL_PROFILE' | 'ONBOARDING';
}
