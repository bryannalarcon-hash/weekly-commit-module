// apps/wc-remote/src/components/PulseInput.tsx — the thin weekly "How was your week?" Pulse (brief
// §6.3 / §4 / §9: kept secondary). A 1–5 rating as a radiogroup (keyboard + AT friendly), an optional
// comment, and a "visible only to my manager" private toggle. Controlled: the parent owns the value and
// persists via the putPulse RTK mutation. Read-only mode renders the recorded reading without inputs.
import { Checkbox, Label, Textarea } from 'flowbite-react';
import type { PulseDto } from '@wcm/types';

const RATINGS = [1, 2, 3, 4, 5] as const;
const RATING_HINT: Record<number, string> = {
  1: 'Rough',
  2: 'Below par',
  3: 'Steady',
  4: 'Good',
  5: 'Great',
};

export interface PulseInputProps {
  value: PulseDto;
  onChange: (next: PulseDto) => void;
  /** When true, render the recorded reading read-only (Locked / past weeks). */
  readOnly?: boolean;
  className?: string;
}

export function PulseInput({
  value,
  onChange,
  readOnly = false,
  className,
}: PulseInputProps): JSX.Element {
  const rating = value.rating;

  if (readOnly) {
    return (
      <section
        data-testid="pulse-input"
        aria-label="Weekly pulse"
        className={`rounded border border-slate-200 bg-slate-50 p-3 ${className ?? ''}`.trim()}
      >
        <p className="text-xs font-medium text-slate-600">How was your week?</p>
        <p className="mt-1 text-sm text-slate-800" data-testid="pulse-readonly-rating">
          {rating ? `${rating} of 5 — ${RATING_HINT[rating]}` : 'Not rated'}
        </p>
        {value.comment && (
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{value.comment}</p>
        )}
      </section>
    );
  }

  return (
    <section
      data-testid="pulse-input"
      className={`rounded border border-slate-200 p-3 ${className ?? ''}`.trim()}
    >
      <p className="text-xs font-medium text-slate-600">How was your week?</p>
      <div
        role="radiogroup"
        aria-label="Week rating, 1 to 5"
        className="mt-2 flex gap-1.5"
      >
        {RATINGS.map((n) => {
          const selected = rating === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${n} — ${RATING_HINT[n]}`}
              data-testid={`pulse-rating-${n}`}
              onClick={() => onChange({ ...value, rating: n })}
              className={[
                'h-8 w-8 rounded text-sm font-semibold ring-1 ring-inset transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500',
                selected
                  ? 'bg-accent-600 text-white ring-accent-600'
                  : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50',
              ].join(' ')}
            >
              {n}
            </button>
          );
        })}
      </div>
      <Textarea
        value={value.comment ?? ''}
        onChange={(e) => onChange({ ...value, comment: e.target.value })}
        rows={2}
        placeholder="Optional comment…"
        aria-label="Pulse comment"
        data-testid="pulse-comment"
        className="mt-2 text-sm"
      />
      <Label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
        <Checkbox
          checked={value.privateToManager}
          onChange={(e) => onChange({ ...value, privateToManager: e.target.checked })}
          data-testid="pulse-private"
        />
        Visible only to my manager
      </Label>
    </section>
  );
}
