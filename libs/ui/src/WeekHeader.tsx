// libs/ui/src/WeekHeader.tsx — the week header block atop My Week / reconciliation / review (design
// components.jsx <WeekHeader>). Renders a mono kicker ("Weekly Commit · {year}"), the week range as an
// h1, the shared LifecycleBadge (so state reads consistently everywhere), an optional due line (red when
// overdue, via text+icon — never color-only), a right-aligned actions slot, and arbitrary children
// (banners, validation summary) below. Wraps the LifecycleBadge primitive (sibling file).
import type { ReactNode } from 'react';
import type { LifecycleState } from '@wcm/types';
import { LifecycleBadge } from './LifecycleBadge';
import { Icon } from './icons';

export interface WeekHeaderProps {
  /** Week range label, e.g. "Week of Jun 8–12". */
  range: ReactNode;
  /** Lifecycle state, drives the shared badge. */
  state: LifecycleState;
  /** Year shown in the kicker (defaults to the current calendar year). */
  year?: string | number;
  /** Human-readable due phrasing, e.g. "Fri Jun 12" (rendered after "Due "). */
  due?: ReactNode;
  /** When true, the due line is shown in the danger color (still icon+text, not color-only). */
  overdue?: boolean;
  /** Right-aligned action buttons (Edit, Submit, Open reconciliation, …). */
  actions?: ReactNode;
  /** Content rendered below the header row (banners, validation summary, etc.). */
  children?: ReactNode;
  className?: string;
}

export function WeekHeader({
  range,
  state,
  year = new Date().getFullYear(),
  due,
  overdue = false,
  actions,
  children,
  className,
}: WeekHeaderProps): JSX.Element {
  return (
    <div
      data-testid="week-header"
      className={`panel ${className ?? ''}`.trim()}
      style={{ padding: '18px 20px', marginBottom: 18 }}
    >
      <div className="between wrap">
        <div>
          <div className="kicker" style={{ marginBottom: 6 }}>
            Weekly Commit · {year}
          </div>
          <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {range}
            </h1>
            <LifecycleBadge state={state} />
          </div>
          {due && (
            <div
              className="inline-flex items-center"
              data-testid="week-due"
              data-overdue={overdue || undefined}
              style={{
                marginTop: 7,
                gap: 6,
                fontSize: 12.5,
                color: overdue ? 'var(--red)' : 'var(--ink-low)',
              }}
            >
              <Icon.clock size={14} /> Due {due}
            </div>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap" style={{ gap: 9 }}>
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
