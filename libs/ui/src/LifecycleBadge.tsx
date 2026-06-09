// libs/ui/src/LifecycleBadge.tsx — the one lifecycle status treatment reused everywhere (brief §4.1),
// re-skinned to the WCM design handoff (prototype/wcm/ui.jsx LifecycleBadge): a pill with the state's
// CSS-var color + light -dim fill + a reinforcing icon + the human-readable label, so the state is
// NEVER conveyed by color alone (a11y). Driven by LIFECYCLE_VISUAL in tokens.ts so a brand/token swap
// is one file. Consumed by My Week, history, review, reconciliation. Preserves data-testid=lifecycle-badge
// and data-state; `size` accepts 'sm'|'md' (legacy 'xs' maps to 'sm').
import type { LifecycleState } from '@wcm/types';
import { LIFECYCLE_VISUAL } from './tokens';
import { getIcon } from './icons';

export interface LifecycleBadgeProps {
  state: LifecycleState;
  /** 'md' (default) or 'sm'; legacy 'xs' is accepted and treated as 'sm'. */
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function LifecycleBadge({
  state,
  size = 'md',
  className,
}: LifecycleBadgeProps): JSX.Element {
  const visual = LIFECYCLE_VISUAL[state];
  const Glyph = getIcon(visual.icon);
  const sm = size === 'sm' || size === 'xs';
  return (
    <span
      data-testid="lifecycle-badge"
      data-state={state}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sm ? 5 : 6,
        padding: sm ? '2px 8px' : '4px 10px',
        fontSize: sm ? 11 : 12,
        fontWeight: 600,
        borderRadius: 'var(--r-pill)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: visual.color,
        background: visual.dim,
        border: `1px solid color-mix(in oklch, ${visual.color} 32%, transparent)`,
      }}
    >
      {Glyph?.({ size: sm ? 12 : 13 })}
      {visual.label}
    </span>
  );
}
