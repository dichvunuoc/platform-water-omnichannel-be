import { SlaCalculator } from '../../domain/services/sla-calculator.domain-service';

describe('SlaCalculator (pure domain service)', () => {
  describe('24/7 schedule', () => {
    it('returns simple deadline - now', () => {
      const now = new Date('2026-06-30T10:00:00Z');
      const created = new Date('2026-06-30T09:00:00Z');
      const deadline = new Date('2026-06-30T13:00:00Z'); // +4h from created

      const remaining = SlaCalculator.calculateRemaining(
        created,
        deadline,
        '24/7',
        now,
      );
      expect(remaining).toBe(3 * 3600 * 1000); // 3h
    });

    it('returns negative when past deadline', () => {
      const now = new Date('2026-06-30T14:00:00Z');
      const created = new Date('2026-06-30T09:00:00Z');
      const deadline = new Date('2026-06-30T13:00:00Z');

      const remaining = SlaCalculator.calculateRemaining(
        created,
        deadline,
        '24/7',
        now,
      );
      expect(remaining).toBe(-1 * 3600 * 1000); // -1h
    });
  });

  describe('BUSINESS_HOURS schedule', () => {
    it('counts only 08:00–17:00 Mon–Fri', () => {
      // Monday 08:00 → Monday 12:00 = 4 business hours elapsed
      const from = new Date('2026-06-29T08:00:00Z'); // Monday 15:00 UTC+7 = Monday 08:00 local
      const to = new Date('2026-06-29T12:00:00Z'); // Monday 19:00 UTC+7 = Monday 12:00 local
      // Wait — these are UTC. Let's use clear business-hours dates.
      // Use local-ish dates where hours are clearly within 8-17.
      const from2 = new Date(2026, 5, 29, 8, 0, 0); // Mon Jun 29 08:00
      const to2 = new Date(2026, 5, 29, 12, 0, 0); // Mon Jun 29 12:00

      const elapsed = SlaCalculator.calculateBusinessMsElapsed(from2, to2);
      expect(elapsed).toBe(4 * 3600 * 1000); // 4h
    });

    it('skips weekend entirely', () => {
      const sat = new Date(2026, 5, 27, 8, 0, 0); // Sat Jun 27 08:00
      const mon = new Date(2026, 5, 29, 8, 0, 0); // Mon Jun 29 08:00

      const elapsed = SlaCalculator.calculateBusinessMsElapsed(sat, mon);
      expect(elapsed).toBe(0); // entire weekend skipped
    });

    it('partial day — starts mid-business-hours', () => {
      const start = new Date(2026, 5, 29, 10, 0, 0); // Mon 10:00
      const end = new Date(2026, 5, 29, 17, 0, 0); // Mon 17:00

      const elapsed = SlaCalculator.calculateBusinessMsElapsed(start, end);
      expect(elapsed).toBe(7 * 3600 * 1000); // 7h (10→17)
    });

    it('multi-day: Mon 10:00 → Tue 12:00 = 7h + 4h = 11h', () => {
      const mon = new Date(2026, 5, 29, 10, 0, 0); // Mon 10:00
      const tue = new Date(2026, 5, 30, 12, 0, 0); // Tue 12:00

      const elapsed = SlaCalculator.calculateBusinessMsElapsed(mon, tue);
      expect(elapsed).toBe(11 * 3600 * 1000); // Mon 10→17 (7h) + Tue 8→12 (4h)
    });

    it('BUSINESS_HOURS remaining < total budget when off-hours elapsed', () => {
      // Created Mon 17:00 (end of day), now Tue 09:00
      // Off-hours elapsed: Mon 17→Tue 08 = 0 business hours
      // Business hours elapsed: Tue 08→09 = 1h
      // If budget is 8h → remaining = 7h
      const created = new Date(2026, 5, 29, 17, 0, 0); // Mon 17:00
      const now = new Date(2026, 5, 30, 9, 0, 0); // Tue 09:00
      const deadline = new Date(created.getTime() + 8 * 3600 * 1000); // 8h budget

      const remaining = SlaCalculator.calculateRemaining(
        created,
        deadline,
        'BUSINESS_HOURS',
        now,
      );
      // 1 business hour elapsed (Tue 08-09) → 7h remaining
      expect(remaining).toBe(7 * 3600 * 1000);
    });
  });

  describe('isWithinBusinessHours', () => {
    it('returns true during weekday business hours', () => {
      const monday = new Date(2026, 5, 29, 10, 0, 0); // Mon 10:00
      expect(SlaCalculator.isWithinBusinessHours(monday)).toBe(true);
    });

    it('returns false on weekend', () => {
      const saturday = new Date(2026, 5, 27, 10, 0, 0); // Sat 10:00
      expect(SlaCalculator.isWithinBusinessHours(saturday)).toBe(false);
    });

    it('returns false at night', () => {
      const night = new Date(2026, 5, 29, 22, 0, 0); // Mon 22:00
      expect(SlaCalculator.isWithinBusinessHours(night)).toBe(false);
    });
  });
});
