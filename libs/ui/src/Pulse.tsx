// libs/ui/src/Pulse.tsx — the thin weekly "How was your week?" Pulse (brief §6.3 / §4 / §9), re-skinned
// to the WCM design (prototype/wcm/ui.jsx Pulse): a 1–5 rating row (filled-up to the chosen number in
// signal-dim), an optional free-text note, and a "visible only to my manager" privacy switch (the shared
// Toggle). Controlled on a single PulseDto value (matches the project data shape + RTK putPulse): the
// parent owns the value and persists. `readOnly` renders the recorded reading without inputs. Preserves
// the Cypress testids the legacy PulseInput used: pulse-input, pulse-rating-{n}, pulse-comment, pulse-private.
import type { PulseDto } from '@wcm/types';
import { Toggle } from './Toggle';

const RATINGS = [1, 2, 3, 4, 5] as const;
const RATING_HINT: Record<number, string> = {
  1: 'Rough',
  2: 'Below par',
  3: 'Steady',
  4: 'Good',
  5: 'Great',
};

export interface PulseProps {
  value: PulseDto;
  onChange: (next: PulseDto) => void;
  /** When true, render the recorded reading read-only (Locked / past weeks). */
  readOnly?: boolean;
  className?: string;
}

export function Pulse({ value, onChange, readOnly = false, className }: PulseProps): JSX.Element {
  const rating = value.rating;

  if (readOnly) {
    return (
      <section
        data-testid="pulse-input"
        aria-label="Weekly pulse"
        className={className}
        style={{
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
          padding: '12px 14px',
        }}
      >
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink-mid)' }}>
          How was your week?
        </p>
        <p
          data-testid="pulse-readonly-rating"
          style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--ink)' }}
        >
          {rating ? `${rating} of 5 — ${RATING_HINT[rating]}` : 'Not rated'}
        </p>
        {value.comment && (
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--ink-mid)', whiteSpace: 'pre-wrap' }}>
            {value.comment}
          </p>
        )}
      </section>
    );
  }

  return (
    <section data-testid="pulse-input" className={className}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>How was your week?</span>
        <div role="radiogroup" aria-label="Week rating, 1 to 5" style={{ display: 'inline-flex', gap: 6 }}>
          {RATINGS.map((n) => {
            const on = rating !== null && n <= rating;
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
                className="tnum"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 'var(--r-sm)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 13,
                  fontFamily: 'var(--sans)',
                  border: `1px solid ${on ? 'var(--signal)' : 'var(--line)'}`,
                  background: on ? 'var(--signal-dim)' : 'var(--surface-1)',
                  color: on ? 'var(--signal-deep)' : 'var(--ink-low)',
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
      <textarea
        className="input"
        rows={2}
        placeholder="Optional note for your manager…"
        value={value.comment ?? ''}
        aria-label="Pulse comment"
        data-testid="pulse-comment"
        onChange={(e) => onChange({ ...value, comment: e.target.value })}
        style={{ marginTop: 12, resize: 'vertical', fontFamily: 'var(--sans)' }}
      />
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 10,
          fontSize: 12.5,
          color: 'var(--ink-mid)',
          cursor: 'pointer',
        }}
      >
        <Toggle
          on={value.privateToManager}
          onChange={(next) => onChange({ ...value, privateToManager: next })}
          label="Visible to your manager only"
        />
        Visible to your manager only
      </label>
    </section>
  );
}
