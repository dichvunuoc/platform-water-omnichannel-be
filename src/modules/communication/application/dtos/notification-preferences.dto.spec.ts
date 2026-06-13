import {
  NotificationChannelPreferenceSchema,
  NotificationPreferencesResponseSchema,
  UpdateNotificationPreferencesPayloadSchema,
  UpdateNotificationPreferencesResponseSchema,
  NotificationDeliveryStatusSchema,
  NotificationHistoryQuerySchema,
  NotificationHistoryItemSchema,
  NotificationHistoryResponseSchema,
  UpdatePreferencesBodySchema,
} from './notification-preferences.dto';

describe('NotificationChannelPreferenceSchema', () => {
  it('should accept valid channel preference', () => {
    const result = NotificationChannelPreferenceSchema.safeParse({
      channel: 'push',
      enabled: true,
      isCritical: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channel).toBe('push');
      expect(result.data.enabled).toBe(true);
      expect(result.data.isCritical).toBe(false);
    }
  });

  it('should accept critical channel preference', () => {
    const result = NotificationChannelPreferenceSchema.safeParse({
      channel: 'in_app',
      enabled: true,
      isCritical: true,
    });
    expect(result.success).toBe(true);
  });

  it('should accept disabled optional channel', () => {
    const result = NotificationChannelPreferenceSchema.safeParse({
      channel: 'sms',
      enabled: false,
      isCritical: false,
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing enabled field', () => {
    expect(NotificationChannelPreferenceSchema.safeParse({
      channel: 'push',
      isCritical: false,
    }).success).toBe(false);
  });

  it('should reject missing isCritical field', () => {
    expect(NotificationChannelPreferenceSchema.safeParse({
      channel: 'push',
      enabled: true,
    }).success).toBe(false);
  });

  it('should reject invalid channel', () => {
    expect(NotificationChannelPreferenceSchema.safeParse({
      channel: 'telegram',
      enabled: true,
      isCritical: false,
    }).success).toBe(false);
  });
});

describe('NotificationPreferencesResponseSchema', () => {
  it('should accept valid response', () => {
    const result = NotificationPreferencesResponseSchema.safeParse({
      customerId: 'USR-001',
      channels: [
        { channel: 'push', enabled: true, isCritical: false },
        { channel: 'in_app', enabled: true, isCritical: true },
      ],
      updatedAt: '2026-06-11T10:30:00Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerId).toBe('USR-001');
      expect(result.data.channels).toHaveLength(2);
    }
  });

  it('should reject empty customerId', () => {
    expect(NotificationPreferencesResponseSchema.safeParse({
      customerId: '',
      channels: [],
      updatedAt: '2026-06-11T10:30:00Z',
    }).success).toBe(false);
  });

  it('should reject missing updatedAt', () => {
    expect(NotificationPreferencesResponseSchema.safeParse({
      customerId: 'USR-001',
      channels: [],
    }).success).toBe(false);
  });
});

describe('UpdateNotificationPreferencesPayloadSchema', () => {
  it('should accept valid payload with single channel', () => {
    const result = UpdateNotificationPreferencesPayloadSchema.safeParse({
      channels: [{ channel: 'push', enabled: true }],
    });
    expect(result.success).toBe(true);
  });

  it('should accept payload with multiple channels', () => {
    const result = UpdateNotificationPreferencesPayloadSchema.safeParse({
      channels: [
        { channel: 'push', enabled: true },
        { channel: 'sms', enabled: false },
        { channel: 'email', enabled: true },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channels).toHaveLength(3);
    }
  });

  it('should reject empty channels array', () => {
    expect(UpdateNotificationPreferencesPayloadSchema.safeParse({
      channels: [],
    }).success).toBe(false);
  });

  it('should reject missing channels field', () => {
    expect(UpdateNotificationPreferencesPayloadSchema.safeParse({}).success).toBe(false);
  });

  it('should reject channel without enabled field', () => {
    expect(UpdateNotificationPreferencesPayloadSchema.safeParse({
      channels: [{ channel: 'push' }],
    }).success).toBe(false);
  });

  it('should NOT allow isCritical in payload — customer cannot set this', () => {
    // The payload schema only accepts { channel, enabled } — isCritical is server-side only
    const result = UpdateNotificationPreferencesPayloadSchema.safeParse({
      channels: [{ channel: 'push', enabled: true, isCritical: true }],
    });
    // Zod strips unknown keys by default in strict mode, but with object shape it rejects extra keys
    // Actually Zod object allows unknown keys by default — they get stripped, not rejected
    // The important thing is isCritical is NOT in the schema, so it's stripped
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data.channels[0] as any).isCritical).toBeUndefined();
    }
  });
});

describe('UpdateNotificationPreferencesResponseSchema', () => {
  it('should be identical to NotificationPreferencesResponseSchema', () => {
    const data = {
      customerId: 'USR-001',
      channels: [
        { channel: 'push', enabled: true, isCritical: false },
        { channel: 'in_app', enabled: true, isCritical: true },
      ],
      updatedAt: '2026-06-11T10:35:00Z',
    };
    expect(UpdateNotificationPreferencesResponseSchema.safeParse(data).success).toBe(true);
    expect(NotificationPreferencesResponseSchema.safeParse(data).success).toBe(true);
  });

  it('should include isCritical in response channels', () => {
    const result = UpdateNotificationPreferencesResponseSchema.safeParse({
      customerId: 'USR-001',
      channels: [
        { channel: 'push', enabled: true, isCritical: true },
      ],
      updatedAt: '2026-06-11T10:35:00Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channels[0].isCritical).toBe(true);
    }
  });
});

describe('NotificationDeliveryStatusSchema', () => {
  it('should accept all valid delivery statuses', () => {
    for (const status of ['sent', 'delivered', 'failed']) {
      expect(NotificationDeliveryStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('should reject invalid delivery status', () => {
    expect(NotificationDeliveryStatusSchema.safeParse('pending').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(NotificationDeliveryStatusSchema.safeParse('').success).toBe(false);
  });
});

describe('NotificationHistoryQuerySchema', () => {
  it('should apply defaults for page and pageSize', () => {
    const result = NotificationHistoryQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it('should coerce string page/pageSize to numbers', () => {
    const result = NotificationHistoryQuerySchema.safeParse({ page: '3', pageSize: '15' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(15);
    }
  });

  it('should reject pageSize > 50', () => {
    expect(NotificationHistoryQuerySchema.safeParse({ pageSize: 51 }).success).toBe(false);
  });

  it('should accept pageSize = 50 (boundary)', () => {
    expect(NotificationHistoryQuerySchema.safeParse({ pageSize: 50 }).success).toBe(true);
  });

  it('should reject page = 0', () => {
    expect(NotificationHistoryQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('should reject negative page', () => {
    expect(NotificationHistoryQuerySchema.safeParse({ page: -1 }).success).toBe(false);
  });

  it('should reject invalid date format', () => {
    expect(NotificationHistoryQuerySchema.safeParse({ startDate: '06-11-2026' }).success).toBe(false);
  });

  it('should reject date with slashes', () => {
    expect(NotificationHistoryQuerySchema.safeParse({ endDate: '2026/06/10' }).success).toBe(false);
  });

  it('should accept valid date format', () => {
    const result = NotificationHistoryQuerySchema.safeParse({ startDate: '2026-06-11' });
    expect(result.success).toBe(true);
  });

  it('should accept both startDate and endDate together', () => {
    const result = NotificationHistoryQuerySchema.safeParse({
      startDate: '2026-01-01',
      endDate: '2026-06-11',
    });
    expect(result.success).toBe(true);
  });

  it('should reject inverted date range (startDate after endDate)', () => {
    const result = NotificationHistoryQuerySchema.safeParse({
      startDate: '2026-12-31',
      endDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('should accept same startDate and endDate', () => {
    const result = NotificationHistoryQuerySchema.safeParse({
      startDate: '2026-06-11',
      endDate: '2026-06-11',
    });
    expect(result.success).toBe(true);
  });

  it('should accept optional channel filter', () => {
    const result = NotificationHistoryQuerySchema.safeParse({ channel: 'zns' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid channel filter', () => {
    expect(NotificationHistoryQuerySchema.safeParse({ channel: 'telegram' }).success).toBe(false);
  });

  it('should accept optional type filter', () => {
    const result = NotificationHistoryQuerySchema.safeParse({ type: 'payment_completed' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid type filter', () => {
    expect(NotificationHistoryQuerySchema.safeParse({ type: 'invalid' }).success).toBe(false);
  });

  it('should accept all filters combined', () => {
    const result = NotificationHistoryQuerySchema.safeParse({
      page: 2,
      pageSize: 10,
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      channel: 'push',
      type: 'alert_outage',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(10);
      expect(result.data.channel).toBe('push');
      expect(result.data.type).toBe('alert_outage');
    }
  });
});

describe('NotificationHistoryItemSchema', () => {
  it('should accept valid history item', () => {
    const result = NotificationHistoryItemSchema.safeParse({
      id: 'NTF-001',
      type: 'payment_completed',
      channel: 'zns',
      contentSummary: 'Payment successful',
      timestamp: '2026-06-11T09:15:00Z',
      deliveryStatus: 'delivered',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty id', () => {
    expect(NotificationHistoryItemSchema.safeParse({
      id: '',
      type: 'payment_completed',
      channel: 'zns',
      contentSummary: 'test',
      timestamp: '2026-06-11T09:15:00Z',
      deliveryStatus: 'sent',
    }).success).toBe(false);
  });

  it('should reject empty contentSummary', () => {
    expect(NotificationHistoryItemSchema.safeParse({
      id: 'NTF-001',
      type: 'payment_completed',
      channel: 'zns',
      contentSummary: '',
      timestamp: '2026-06-11T09:15:00Z',
      deliveryStatus: 'sent',
    }).success).toBe(false);
  });

  it('should reject missing required fields', () => {
    expect(NotificationHistoryItemSchema.safeParse({
      id: 'NTF-001',
    }).success).toBe(false);
  });
});

describe('NotificationHistoryResponseSchema', () => {
  it('should accept valid response', () => {
    const result = NotificationHistoryResponseSchema.safeParse({
      notifications: [
        {
          id: 'NTF-001',
          type: 'payment_completed',
          channel: 'zns',
          contentSummary: 'Payment successful',
          timestamp: '2026-06-11T09:15:00Z',
          deliveryStatus: 'delivered',
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notifications).toHaveLength(1);
      expect(result.data.totalCount).toBe(1);
    }
  });

  it('should accept empty notifications array', () => {
    const result = NotificationHistoryResponseSchema.safeParse({
      notifications: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(true);
  });
});

describe('UpdatePreferencesBodySchema', () => {
  it('should be aliased to UpdateNotificationPreferencesPayloadSchema', () => {
    const data = { channels: [{ channel: 'push' as const, enabled: true }] };
    expect(UpdatePreferencesBodySchema.safeParse(data).success).toBe(true);
    expect(UpdateNotificationPreferencesPayloadSchema.safeParse(data).success).toBe(true);
  });
});
