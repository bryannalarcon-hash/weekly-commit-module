// libs/ui/src/LifecycleBadge.tsx — the one lifecycle status treatment reused everywhere (brief §4.1).
// Renders the human-readable label + a state-specific icon + a semantic Flowbite Badge color so the
// state is NEVER conveyed by color alone (a11y). Driven by LIFECYCLE_VISUAL in tokens.ts so a token
// swap is one file. Consumed by My Week, history, review, reconciliation surfaces.
import { Badge } from 'flowbite-react';
import type { ComponentProps, FC } from 'react';
import type { LifecycleState } from '@wcm/types';
import { LIFECYCLE_VISUAL } from './tokens';
import {
  CheckCircleIcon,
  ForwardIcon,
  LockIcon,
  PencilIcon,
  ReconcileIcon,
} from './icons';

const ICON: Record<LifecycleState, FC<ComponentProps<'svg'>>> = {
  DRAFT: PencilIcon,
  LOCKED: LockIcon,
  RECONCILING: ReconcileIcon,
  RECONCILED: CheckCircleIcon,
  CARRY_FORWARD: ForwardIcon,
};

export interface LifecycleBadgeProps {
  state: LifecycleState;
  /** Optional size pass-through; defaults to Flowbite's small badge. */
  size?: 'xs' | 'sm';
  className?: string;
}

export function LifecycleBadge({
  state,
  size = 'sm',
  className,
}: LifecycleBadgeProps): JSX.Element {
  const visual = LIFECYCLE_VISUAL[state];
  const Icon = ICON[state];
  return (
    <Badge
      color={visual.flowbiteColor}
      size={size}
      data-testid="lifecycle-badge"
      data-state={state}
      className={className}
      // The visible text label carries the meaning; the icon is reinforcement (never color-only).
      icon={Icon}
    >
      {visual.label}
    </Badge>
  );
}
