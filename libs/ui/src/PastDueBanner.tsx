// libs/ui/src/PastDueBanner.tsx — the overdue banner for My Week (design components.jsx <PastDueBanner>,
// brief §6.2). Restyled to the OKLCH token system: a red-tinted, non-punitive alert that announces the
// week is past due (warning icon + text, role=alert — never color-only) and nudges the member to lock it
// now so the plan is on record. Keeps an optional right-aligned `action` slot for callers that pass one.
import type { ReactNode } from 'react';
import { Icon } from './icons';

export interface PastDueBannerProps {
  /** Human-readable due phrasing, e.g. "due Friday, Jun 13". */
  dueLabel?: string;
  /** Optional action node (e.g. a "Submit now" button) rendered on the right. */
  action?: ReactNode;
  className?: string;
}

export function PastDueBanner({
  dueLabel,
  action,
  className,
}: PastDueBannerProps): JSX.Element {
  return (
    <div
      role="alert"
      data-testid="past-due-banner"
      className={`flex flex-wrap items-center ${className ?? ''}`.trim()}
      style={{
        gap: 11,
        padding: '12px 16px',
        borderRadius: 'var(--r-md)',
        background: 'var(--red-dim)',
        border: '1px solid color-mix(in oklch, var(--red) 30%, transparent)',
        marginBottom: 16,
      }}
    >
      <span style={{ color: 'var(--red)', flex: 'none' }}>
        <Icon.alert size={18} />
      </span>
      <div style={{ flex: 1, fontSize: 13.5 }}>
        <strong style={{ color: 'var(--red)' }}>This week is past due.</strong>{' '}
        <span style={{ color: 'var(--ink-mid)' }}>
          {dueLabel ? `It was ${dueLabel}. ` : ''}Lock it now so your plan is on record.
        </span>
      </div>
      {action && <div style={{ flex: 'none' }}>{action}</div>}
    </div>
  );
}
