import { MockProactiveNotificationAdapter } from './proactive-notification.port';
import type { GetActiveAlertsResponse, AlertHistoryResponse, AcknowledgeAlertResponse } from '../../application/dtos/proactive-notification.dto';

describe('MockProactiveNotificationAdapter', () => {
  let adapter: MockProactiveNotificationAdapter;

  beforeEach(() => {
    adapter = new MockProactiveNotificationAdapter();
  });

  describe('get-active-alerts', () => {
    it('should read and validate get-active-alerts.json', async () => {
      const result = await adapter.execute('get-active-alerts', { customerId: 'USR-001' }) as GetActiveAlertsResponse;

      expect(result).toBeDefined();
      expect(result.alerts).toBeInstanceOf(Array);
      expect(result.totalCount).toBeGreaterThan(0);

      const alert = result.alerts[0];
      expect(alert.id).toBeDefined();
      expect(alert.type).toMatch(/^(outage|maintenance|quality)$/);
      expect(alert.description).toBeDefined();
      expect(alert.affectedArea).toBeDefined();
      expect(alert.expectedStartTime).toBeDefined();
      expect(alert.expectedEndTime).toBeDefined();
      expect(alert.status).toMatch(/^(active|resolved|scheduled)$/);
    });
  });

  describe('get-alert-history', () => {
    it('should read and validate get-alert-history.json', async () => {
      const result = await adapter.execute('get-alert-history', { customerId: 'USR-001' }) as AlertHistoryResponse;

      expect(result).toBeDefined();
      expect(result.alerts).toBeInstanceOf(Array);
      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.page).toBeDefined();
      expect(result.pageSize).toBeDefined();

      const item = result.alerts[0];
      expect(item.id).toBeDefined();
      expect(item.type).toMatch(/^(outage|maintenance|quality)$/);
      expect(item.startTime).toBeDefined();
      expect(item.endTime).toBeDefined();
      expect(item.status).toBeDefined();
    });
  });

  describe('acknowledge-alert', () => {
    it('should read and validate acknowledge-alert.json', async () => {
      const result = await adapter.execute('acknowledge-alert', {
        alertId: 'ALERT-2026-001',
        customerId: 'USR-001',
      }) as AcknowledgeAlertResponse;

      expect(result).toBeDefined();
      expect(result.alertId).toBeDefined();
      expect(result.customerId).toBeDefined();
      expect(result.acknowledgedAt).toBeDefined();
    });
  });

  describe('schema validation', () => {
    it('should throw for unknown method', async () => {
      await expect(
        adapter.execute('unknown-method', {}),
      ).rejects.toThrow();
    });
  });
});
