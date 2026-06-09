// libs/ui/src/PastDueBanner.tsx — the overdue banner for My Week (brief §6.2). Non-punitive, clear,
// retryable: announces the week is past due (text + warning icon, role=alert) with an optional
// primary action ("Submit now"). Color is never the only signal.
import type { ReactNode } from 'react';
import { WarningIcon } from './icons';

export interface PastDueBannerProps {
  /** Human-readable due phrasing, e.g. "Due Friday, Jun 13". */
  dueLabel?: string;
  /** Optional action node (e.g. a Flowbite Button) rendered on the right. */
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
      className={`flex flex-wrap items-center justify-between gap-3 rounded border border-amber-300 bg-amber-50 px-4 py-3 ${className ?? ''}`.trim()}
    >
      <div className="flex items-start gap-2">
        <WarningIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold text-amber-800">This week is past due</p>
          <p className="text-amber-700">
            {dueLabel
              ? `It was ${dueLabel}. You can still submit — nothing is lost.`
              : 'You can still submit — nothing is lost.'}
          </p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
