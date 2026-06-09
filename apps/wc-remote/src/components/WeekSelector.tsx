// apps/wc-remote/src/components/WeekSelector.tsx — the week picker for the manager Review Queue
// (brief §6.7 / §7). A labelled native <select> of recent Monday-start weeks rendered as human-readable
// ranges ("Week of Jun 8 – 12"); the value is the ISO week-start the parent feeds to the review-queue
// query. recentWeeks() builds the option list from today backwards. Keyboard + AT friendly.
import { Label, Select } from 'flowbite-react';
import { formatWeekRange, parseIsoDate } from '../lib/week';

/** ISO (yyyy-MM-dd) for the Monday of the week containing `from`, then `count` Mondays going back. */
export function recentWeeks(count = 8, from: Date = new Date()): string[] {
  const monday = new Date(from);
  const day = monday.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7;
  monday.setDate(monday.getDate() - diffToMonday);
  monday.setHours(12, 0, 0, 0);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(monday);
    d.setDate(monday.getDate() - i * 7);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`,
    );
  }
  return out;
}

export interface WeekSelectorProps {
  /** Selected ISO week-start; when omitted the first option is selected. */
  value?: string;
  onChange: (weekStartIso: string) => void;
  weeks?: string[];
  id?: string;
  className?: string;
}

export function WeekSelector({
  value,
  onChange,
  weeks = recentWeeks(),
  id = 'week-selector',
  className,
}: WeekSelectorProps): JSX.Element {
  return (
    <div className={className}>
      <Label htmlFor={id} className="sr-only">
        Select a week
      </Label>
      <Select
        id={id}
        sizing="sm"
        value={value ?? weeks[0] ?? ''}
        data-testid="week-selector"
        aria-label="Select a week"
        onChange={(e) => onChange(e.target.value)}
      >
        {weeks.map((w) => (
          <option key={w} value={w}>
            {formatWeekRange(parseIsoDate(w).toISOString().slice(0, 10))}
          </option>
        ))}
      </Select>
    </div>
  );
}
