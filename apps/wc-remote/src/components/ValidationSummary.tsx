// apps/wc-remote/src/components/ValidationSummary.tsx — the "what's blocking Submit" summary for the
// EditCommit screen (brief §6.3 / §7). Mirrors the server DRAFT→LOCKED guard: every item must link a
// Supporting Outcome. Renders a non-punitive, role=alert list of blockers (text + icon, not color-only)
// and stays absent when the commit is valid. Pure/presentational — the parent computes the blocker list.
import { WarningIcon } from '@wcm/ui';

export interface ValidationSummaryProps {
  /** Human-readable blocking reasons; empty ⇒ valid ⇒ nothing renders. */
  blockers: string[];
  className?: string;
}

export function ValidationSummary({ blockers, className }: ValidationSummaryProps): JSX.Element | null {
  if (blockers.length === 0) return null;
  return (
    <div
      role="alert"
      data-testid="validation-summary"
      className={`rounded border border-amber-300 bg-amber-50 px-4 py-3 ${className ?? ''}`.trim()}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
        <WarningIcon className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        {blockers.length === 1
          ? '1 thing needs attention before you can lock'
          : `${blockers.length} things need attention before you can lock`}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-9 text-sm text-amber-700">
        {blockers.map((b, i) => (
          <li key={i} data-testid="validation-blocker">
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}
