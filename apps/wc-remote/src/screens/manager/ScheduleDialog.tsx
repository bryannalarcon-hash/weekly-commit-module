// apps/wc-remote/src/screens/manager/ScheduleDialog.tsx — the CB-1 "Schedule 1:1" modal on the manager
// review surface. A centered Scrim modal in the ConfirmDialog visual pattern (tinted icon tile, panel
// surface, ghost/primary footer, busy in-flight state) prefilled with "1:1 — <report>", tomorrow 10:00
// and 30 minutes; posts via useScheduleOutlookEventMutation (POST /integration/outlook/schedule, start
// as ISO WITH the local UTC offset) and maps the 409 illegal_state ProblemDetail to an inline
// "Connect Outlook in Settings → Integrations first" error. The parent owns open/close + the success note.
import { useState } from 'react';
import { useScheduleOutlookEventMutation } from '@wcm/api';
import { Icon, Scrim } from '@wcm/ui';

export interface ScheduleDialogProps {
  /** The report (direct report) the 1:1 is with — becomes the event's reportMemberId. */
  reportMemberId: string;
  /** Display name of the report; seeds the default subject ("1:1 — <name>"). */
  reportName: string;
  onClose: () => void;
  /** Called with the created Graph event id after a successful schedule (parent closes + notes ✓). */
  onScheduled: (eventId: string) => void;
}

/** Duration choices surfaced in the select (minutes). */
const DURATIONS: ReadonlyArray<number> = [15, 30, 45, 60];

/** Tomorrow's LOCAL calendar date as yyyy-MM-dd — the default 1:1 date. */
function tomorrowIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Combine the picked local date (yyyy-MM-dd) + time (HH:mm[:ss]) into an ISO-8601 date-time WITH the
 * local UTC offset (e.g. 2026-06-10T10:00:00-05:00), so the backend/Graph receives an absolute
 * instant. The offset is computed AT that wall-clock time, so DST transitions resolve correctly.
 */
function toIsoWithOffset(date: string, time: string): string {
  const hms = time.length === 5 ? `${time}:00` : time;
  const offsetMinutes = -new Date(`${date}T${hms}`).getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const oh = String(Math.floor(abs / 60)).padStart(2, '0');
  const om = String(abs % 60).padStart(2, '0');
  return `${date}T${hms}${sign}${oh}:${om}`;
}

/** Map a schedule-mutation failure to user copy; 409 illegal_state = no Outlook link yet. */
function scheduleErrorMessage(err: unknown): string {
  const e = err as { status?: number; data?: { code?: string } } | null;
  if (e?.status === 409 && e.data?.code === 'illegal_state') {
    return 'Connect Outlook in Settings → Integrations first';
  }
  return 'Could not schedule the event — try again.';
}

/** Shared kicker label style for the form fields. */
const labelStyle = { display: 'block', marginBottom: 6 } as const;

export function ScheduleDialog({
  reportMemberId,
  reportName,
  onClose,
  onScheduled,
}: ScheduleDialogProps): JSX.Element {
  const [scheduleEvent, scheduleState] = useScheduleOutlookEventMutation();
  const [subject, setSubject] = useState(`1:1 — ${reportName}`);
  const [date, setDate] = useState(tomorrowIsoDate);
  const [time, setTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const busy = scheduleState.isLoading;
  const valid = subject.trim() !== '' && date !== '' && time !== '';

  const submit = (): void => {
    if (busy || !valid) return;
    setError(null);
    void scheduleEvent({
      reportMemberId,
      subject: subject.trim(),
      startDateTime: toIsoWithOffset(date, time),
      durationMinutes,
      ...(note.trim() !== '' ? { note: note.trim() } : {}),
    })
      .unwrap()
      .then((res) => onScheduled(res.eventId))
      .catch((err: unknown) => setError(scheduleErrorMessage(err)));
  };

  return (
    <Scrim onClose={busy ? () => undefined : onClose} label="Schedule a 1:1">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Schedule a 1:1 with ${reportName}`}
        data-testid="schedule-dialog"
        style={{
          width: 460,
          maxWidth: '92vw',
          borderRadius: 'var(--r-md)',
          background: 'var(--surface-1)',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow-pop)',
          animation: 'riseIn .2s ease both',
          overflow: 'hidden',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div style={{ padding: '22px 22px 18px' }}>
            <div style={{ display: 'flex', gap: 13, marginBottom: 16 }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  flex: 'none',
                  borderRadius: 'var(--r-sm)',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--cyan-dim)',
                  color: 'var(--cyan)',
                }}
              >
                <Icon.week size={20} aria-hidden />
              </span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Schedule 1:1</div>
                <div style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5 }}>
                  Creates an Outlook event for you and {reportName}.
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="kicker" htmlFor="schedule-subject" style={labelStyle}>
                  Subject
                </label>
                <input
                  id="schedule-subject"
                  className="input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={busy}
                  data-testid="schedule-subject"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="kicker" htmlFor="schedule-date" style={labelStyle}>
                    Date
                  </label>
                  <input
                    id="schedule-date"
                    type="date"
                    className="input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={busy}
                    data-testid="schedule-date"
                  />
                </div>
                <div>
                  <label className="kicker" htmlFor="schedule-time" style={labelStyle}>
                    Time
                  </label>
                  <input
                    id="schedule-time"
                    type="time"
                    className="input"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    disabled={busy}
                    data-testid="schedule-time"
                  />
                </div>
              </div>

              <div>
                <label className="kicker" htmlFor="schedule-duration" style={labelStyle}>
                  Duration
                </label>
                <select
                  id="schedule-duration"
                  className="input"
                  value={String(durationMinutes)}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  disabled={busy}
                  data-testid="schedule-duration"
                >
                  {DURATIONS.map((mins) => (
                    <option key={mins} value={String(mins)}>
                      {mins} minutes
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="kicker" htmlFor="schedule-note" style={labelStyle}>
                  Note <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <textarea
                  id="schedule-note"
                  className="input"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Agenda, context, links…"
                  disabled={busy}
                  data-testid="schedule-note"
                  style={{ resize: 'vertical', fontFamily: 'var(--sans)' }}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  data-testid="schedule-error"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 12px',
                    background: 'var(--red-dim)',
                    border: '1px solid color-mix(in oklch, var(--red) 30%, transparent)',
                    borderRadius: 'var(--r-sm)',
                    fontSize: 12.5,
                    color: 'var(--red)',
                    fontWeight: 600,
                  }}
                >
                  <Icon.alert size={14} style={{ flex: 'none' }} aria-hidden />
                  {error}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 9,
              padding: '14px 18px',
              borderTop: '1px solid var(--line-soft)',
              background: 'var(--surface-2)',
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              data-testid="schedule-cancel"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="schedule-submit"
              disabled={busy || !valid}
            >
              {busy ? <Icon.spinner size={15} aria-hidden /> : <Icon.week size={15} aria-hidden />}
              Schedule
            </button>
          </div>
        </form>
      </div>
    </Scrim>
  );
}
