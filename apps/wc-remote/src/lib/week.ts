// apps/wc-remote/src/lib/week.ts — small pure helpers for rendering a weekly commit's dates and
// progress in viewer-facing copy (e.g. "Week of Jun 8 – 12", "Due Friday", "2 of 4 done"). Kept
// framework-free so screens and their tests share one formatting source. No I/O.
import type { CommitItemDto, WeekSummary } from '@wcm/types';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** Parse an ISO date (yyyy-MM-dd) as a local-noon Date to avoid TZ off-by-one. */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => Number(n));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}

/** "Week of Jun 8 – 12" (same month) or "Week of Jun 30 – Jul 4" (spanning), Mon→Fri work week. */
export function formatWeekRange(weekStartIso: string): string {
  const start = parseIsoDate(weekStartIso);
  const end = new Date(start);
  end.setDate(start.getDate() + 4); // Mon..Fri
  const sMonth = MONTHS[start.getMonth()] ?? '';
  const eMonth = MONTHS[end.getMonth()] ?? '';
  if (start.getMonth() === end.getMonth()) {
    return `Week of ${sMonth} ${start.getDate()} – ${end.getDate()}`;
  }
  return `Week of ${sMonth} ${start.getDate()} – ${eMonth} ${end.getDate()}`;
}

/** Friday due label for a Mon-start week, e.g. "Due Friday, Jun 12". */
export function formatDueLabel(weekStartIso: string): string {
  const friday = parseIsoDate(weekStartIso);
  friday.setDate(friday.getDate() + 4);
  const month = MONTHS[friday.getMonth()] ?? '';
  return `Due Friday, ${month} ${friday.getDate()}`;
}

/** "2 of 4 done" progress label from item counts. */
export function formatProgress(completed: number, total: number): string {
  return `${completed} of ${total} done`;
}

/** Count completed items in a list (status === COMPLETE). */
export function completedCount(items: CommitItemDto[]): number {
  return items.filter((i) => i.status === 'COMPLETE').length;
}

/** A week is "past due" when it is still an editable Draft and its Friday is in the past. */
export function isPastDue(week: Pick<WeekSummary, 'weekStart' | 'lifecycleState'>, now: Date = new Date()): boolean {
  if (week.lifecycleState !== 'DRAFT') return false;
  const friday = parseIsoDate(week.weekStart);
  friday.setDate(friday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return now.getTime() > friday.getTime();
}
