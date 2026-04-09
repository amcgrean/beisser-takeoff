/**
 * Central Time utilities for LiveEdge.
 * All display times shown to users should be in America/Chicago (CT), which
 * automatically handles CDT/CST transitions (daylight saving).
 *
 * Rule of thumb:
 *  - Database writes: always store as UTC via SQL NOW() — Postgres timestamptz handles it.
 *  - SQL date comparisons: use (NOW() AT TIME ZONE 'America/Chicago')::date, not CURRENT_DATE.
 *  - Display: always pass through formatTimeCT / formatDateCT / formatDateTimeCT.
 *  - Elapsed time on active picks: use businessMinutesElapsed (7 AM–5 PM CT, M–F).
 */

const TZ = 'America/Chicago';

/** Display a timestamp as a time string in Central Time. e.g. "2:34 PM" */
export function formatTimeCT(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Display a timestamp as a short date in Central Time. e.g. "Apr 9, 2026" */
export function formatDateCT(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Display a timestamp as date + time in Central Time. e.g. "Apr 9, 2:34 PM" */
export function formatDateTimeCT(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// Business-hours elapsed time
// ---------------------------------------------------------------------------

const BIZ_START_H = 7;   // 7:00 AM CT
const BIZ_END_H   = 17;  // 5:00 PM CT

/** Extract hour (0-23), minute, and day-of-week (0=Sun…6=Sat) in CT. */
function ctParts(d: Date): { h: number; min: number; dow: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
    hourCycle: 'h23',
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';

  const DOW: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };

  return {
    h:   parseInt(get('hour'),   10),
    min: parseInt(get('minute'), 10),
    dow: DOW[get('weekday')] ?? 0,
  };
}

/** True if day-of-week is Mon–Fri. */
function isWeekday(dow: number): boolean {
  return dow >= 1 && dow <= 5;
}

/**
 * Clamp total-minutes-since-midnight to the business window and return
 * how many business minutes fall before that point.
 * e.g. totalMins=480 (8 AM) → 60 (one hour into the 7 AM window)
 */
function bizMinsAtPoint(totalMins: number): number {
  return Math.max(0, Math.min(totalMins, BIZ_END_H * 60) - BIZ_START_H * 60);
}

/** A stable CT date label used to compare calendar days. */
function ctDateLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * How many business-hours minutes have elapsed since `startIso`?
 * Business hours = 7:00 AM – 5:00 PM CT, Monday–Friday.
 * DST transitions are handled automatically via Intl.DateTimeFormat.
 *
 * Designed for active-pick elapsed time on the supervisor / open-picks views.
 * Picks that started before business hours are treated as starting at 7 AM.
 * Picks running after 5 PM stop accumulating until 7 AM next weekday.
 */
export function businessMinutesElapsed(startIso: string): number {
  const start = new Date(startIso);
  const now   = new Date();
  if (now <= start) return 0;

  const { h: sh, min: sm, dow: sdow } = ctParts(start);
  const { h: eh, min: em, dow: edow } = ctParts(now);

  // ── Same calendar day ──────────────────────────────────────────────────────
  if (ctDateLabel(start) === ctDateLabel(now)) {
    if (!isWeekday(sdow)) return 0;
    const s = Math.max(sh * 60 + sm, BIZ_START_H * 60);
    const e = Math.min(eh * 60 + em, BIZ_END_H   * 60);
    return Math.max(0, e - s);
  }

  // ── Multi-day ──────────────────────────────────────────────────────────────
  let total = 0;

  // Remainder of start day
  if (isWeekday(sdow)) {
    total += bizMinsAtPoint(BIZ_END_H * 60) - bizMinsAtPoint(sh * 60 + sm);
  }

  // Full intermediate days (advance by 24-hour chunks; handles DST transitions
  // because ctDateLabel will reflect the actual CT calendar date)
  let cursor = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  let safety = 0;
  while (ctDateLabel(cursor) !== ctDateLabel(now) && safety < 14) {
    const { dow } = ctParts(cursor);
    if (isWeekday(dow)) total += (BIZ_END_H - BIZ_START_H) * 60;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    safety++;
  }

  // Portion of end day
  if (isWeekday(edow)) {
    total += bizMinsAtPoint(eh * 60 + em);
  }

  return Math.max(0, total);
}
