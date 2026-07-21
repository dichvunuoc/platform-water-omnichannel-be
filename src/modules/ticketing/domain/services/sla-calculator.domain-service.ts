import type { SlaSchedule } from '../value-objects/ticket-priority.value-object';

/**
 * SLA Calculator (pure domain service — no I/O, fully testable)
 *
 * Computes remaining SLA time based on:
 *   - 24/7: simple deadline - now
 *   - BUSINESS_HOURS: count only 08:00–17:00 Mon–Fri (Vietnam timezone UTC+7)
 *
 * Business rules (PRD §2.1):
 *   - P0/P1: 24/7 countdown (no pause)
 *   - P2/P3: pauses outside 08:00–17:00 Mon–Fri + holidays (holiday = G2)
 */
export class SlaCalculator {
  /** Vietnam business hours */
  static readonly BUSINESS_START_HOUR = 8;
  static readonly BUSINESS_END_HOUR = 17;
  static readonly MS_PER_HOUR = 3600 * 1000;

  /**
   * Calculate remaining SLA milliseconds.
   *
   * For 24/7: simply `deadline - now`.
   * For BUSINESS_HOURS: compute elapsed business-hours between createdAt→now,
   * then `totalBudget - elapsedBusinessMs`.
   */
  static calculateRemaining(
    createdAt: Date,
    deadline: Date,
    schedule: SlaSchedule,
    now: Date = new Date(),
  ): number {
    if (schedule === '24/7') {
      return deadline.getTime() - now.getTime();
    }

    // BUSINESS_HOURS: compute how much business time has elapsed
    const totalBudgetMs = deadline.getTime() - createdAt.getTime();
    const elapsedBusinessMs = this.calculateBusinessMsElapsed(createdAt, now);
    return totalBudgetMs - elapsedBusinessMs;
  }

  /**
   * Sum all business-hours milliseconds between two dates.
   * Iterates day-by-day (efficient enough for ticket SLA ranges: hours to days).
   */
  static calculateBusinessMsElapsed(from: Date, to: Date): number {
    if (to <= from) return 0;

    let totalMs = 0;
    const cursor = new Date(from);

    while (cursor < to) {
      const dayStart = new Date(cursor);
      dayStart.setHours(this.BUSINESS_START_HOUR, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(this.BUSINESS_END_HOUR, 0, 0, 0);

      // Skip weekends (0=Sun, 6=Sat)
      const dayOfWeek = cursor.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const effectiveStart = cursor > dayStart ? cursor : dayStart;
        const effectiveEnd = to < dayEnd ? to : dayEnd;
        if (effectiveEnd > effectiveStart) {
          totalMs += effectiveEnd.getTime() - effectiveStart.getTime();
        }
      }

      // Move to next day
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }

    return totalMs;
  }

  /**
   * Check if a given date is within business hours.
   */
  static isWithinBusinessHours(date: Date = new Date()): boolean {
    const day = date.getDay();
    if (day === 0 || day === 6) return false; // weekend
    const hour = date.getHours();
    return hour >= this.BUSINESS_START_HOUR && hour < this.BUSINESS_END_HOUR;
  }
}
