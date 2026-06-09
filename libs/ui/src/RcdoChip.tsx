// libs/ui/src/RcdoChip.tsx — the RCDO link as a first-class element (design brief §4.2).
// Renders the linked Supporting Outcome as a chip and, optionally, its full 4-level breadcrumb
// (Rally Cry › Defining Objective › Outcome › Supporting Outcome) with truncation + native tooltip.
// Also exports RcdoBreadcrumb (standalone) and an "unlinked" affordance that visibly blocks submit.
import type { ReactNode } from 'react';
import { ChevronRightIcon, WarningIcon, XMarkIcon } from './icons';

/** A path of human-readable titles, root → leaf. The leaf is the Supporting Outcome. */
export interface RcdoPath {
  rallyCry: string;
  definingObjective: string;
  outcome: string;
  supportingOutcome: string;
}

export interface RcdoBreadcrumbProps {
  path: RcdoPath;
  /** Truncate each crumb to this many chars (full text stays in the title tooltip). */
  className?: string;
}

const crumbs = (path: RcdoPath): string[] => [
  path.rallyCry,
  path.definingObjective,
  path.outcome,
  path.supportingOutcome,
];

/** The full Rally Cry › … › Supporting Outcome trail, with chevron separators + a tooltip. */
export function RcdoBreadcrumb({ path, className }: RcdoBreadcrumbProps): JSX.Element {
  const trail = crumbs(path);
  const full = trail.join(' › ');
  return (
    <nav
      aria-label="Strategy path"
      title={full}
      data-testid="rcdo-breadcrumb"
      className={`flex min-w-0 items-center gap-1 text-xs text-slate-500 ${className ?? ''}`.trim()}
    >
      {trail.map((label, i) => (
        <span key={`${label}-${i}`} className="flex min-w-0 items-center gap-1">
          {i > 0 && <ChevronRightIcon className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />}
          <span
            className={
              i === trail.length - 1
                ? 'truncate font-medium text-slate-700'
                : 'truncate'
            }
          >
            {label}
          </span>
        </span>
      ))}
    </nav>
  );
}

export interface RcdoChipProps {
  /** Title of the linked Supporting Outcome (required when linked). */
  title?: string | null;
  /** Optional full breadcrumb; when present, shown under the chip. */
  path?: RcdoPath | null;
  /** Fired when the user clears the link (omit to hide the clear affordance). */
  onClear?: () => void;
  className?: string;
}

function Pill({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700 ring-1 ring-inset ring-accent-200">
      {children}
    </span>
  );
}

/**
 * Shows the linked Supporting Outcome. When NOT linked, renders a visible "Needs a Supporting
 * Outcome" warning (text + icon, not color-only) so an unlinked item reads as incomplete (brief §4.2).
 */
export function RcdoChip({ title, path, onClear, className }: RcdoChipProps): JSX.Element {
  if (!title) {
    return (
      <span
        data-testid="rcdo-chip-unlinked"
        className={`inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200 ${className ?? ''}`.trim()}
      >
        <WarningIcon className="h-3.5 w-3.5" aria-hidden />
        Needs a Supporting Outcome
      </span>
    );
  }
  return (
    <span
      data-testid="rcdo-chip"
      className={`inline-flex min-w-0 flex-col gap-0.5 ${className ?? ''}`.trim()}
    >
      <span className="flex min-w-0 items-center gap-1">
        <Pill>
          <span className="truncate" title={title}>
            {title}
          </span>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label={`Clear link to ${title}`}
              className="ml-0.5 rounded-full p-0.5 text-accent-600 hover:bg-accent-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            >
              <XMarkIcon className="h-3 w-3" aria-hidden />
            </button>
          )}
        </Pill>
      </span>
      {path && <RcdoBreadcrumb path={path} />}
    </span>
  );
}
