// libs/ui/src/RcdoBreadcrumb.tsx — the faint RCDO strategy "ladder" trail (brief §4.2), re-skinned to
// the WCM design (prototype/wcm/ui.jsx RcdoBreadcrumb): a mono, uppercase, low-contrast crumb path
// Rally Cry › Defining Objective › Outcome › Supporting Outcome, with the leaf (the linked Supporting
// Outcome) rendered in signal-green and not uppercased. Chevron separators. Full text in the title
// tooltip; truncation-friendly. Preserves the RcdoPath type + data-testid=rcdo-breadcrumb.
import { Fragment } from 'react';
import { Icon } from './icons';

/** A path of human-readable titles, root → leaf. The leaf is the Supporting Outcome. */
export interface RcdoPath {
  rallyCry: string;
  definingObjective: string;
  outcome: string;
  supportingOutcome: string;
}

export interface RcdoBreadcrumbProps {
  path: RcdoPath;
  /** Tighter type scale for dense rows. */
  compact?: boolean;
  className?: string;
}

/** Ordered crumbs root → leaf; empty intermediate levels are dropped so a partial path still reads. */
export function crumbsOf(path: RcdoPath): string[] {
  return [path.rallyCry, path.definingObjective, path.outcome, path.supportingOutcome].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
}

/** The full Rally Cry › … › Supporting Outcome ladder, with chevron separators + a tooltip. */
export function RcdoBreadcrumb({ path, compact, className }: RcdoBreadcrumbProps): JSX.Element {
  const trail = crumbsOf(path);
  const full = trail.join('  ›  ');
  return (
    <nav
      aria-label="Strategy path"
      title={full}
      data-testid="rcdo-breadcrumb"
      className={`mono ${className ?? ''}`.trim()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        minWidth: 0,
        fontSize: compact ? 9.5 : 10.5,
        letterSpacing: '0.03em',
        color: 'var(--ink-faint)',
      }}
    >
      {trail.map((label, i) => {
        const isLeaf = i === trail.length - 1;
        return (
          <Fragment key={`${label}-${i}`}>
            <span
              style={{
                color: isLeaf ? 'var(--signal-deep)' : 'var(--ink-faint)',
                fontWeight: isLeaf ? 600 : 400,
                textTransform: isLeaf ? 'none' : 'uppercase',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >
              {label}
            </span>
            {!isLeaf && <Icon.chevR size={11} style={{ opacity: 0.5, flex: 'none' }} />}
          </Fragment>
        );
      })}
    </nav>
  );
}
