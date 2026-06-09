// libs/ui/src/CarriedForwardCard.tsx — surfaces an item brought from a prior week with its lineage
// ("Carried from last week"), per brief §6.2/§6.3, restyled to the OKLCH token system. Distinct violet
// "carry" treatment: a left rail + a carry-icon lineage pill (text, never color-only). Optional per-item
// actions (mark complete / carry forward / drop) render in the footer. testid "carried-block" is what
// the My-Week carried section queries; the chess tier renders human-readable (never the raw enum).
import type { ReactNode } from 'react';
import type { ChessTier } from '@wcm/types';
import { Icon } from './icons';
import { CHESS_LABEL } from './tokens';

export interface CarriedForwardCardProps {
  /** The carried item's text. */
  text: string;
  /** Human-readable lineage, e.g. "Carried from week of Jun 1". Defaults to last week. */
  lineageLabel?: string;
  /** Optional chess tier badge label. */
  chessTier?: ChessTier | null;
  /** Optional action controls (buttons) rendered in the footer. */
  actions?: ReactNode;
  className?: string;
}

export function CarriedForwardCard({
  text,
  lineageLabel = 'Carried from last week',
  chessTier,
  actions,
  className,
}: CarriedForwardCardProps): JSX.Element {
  return (
    <article
      data-testid="carried-block"
      className={`panel ${className ?? ''}`.trim()}
      style={{ padding: '13px 15px', borderLeft: '3px solid var(--violet)' }}
    >
      <span
        className="inline-flex items-center"
        style={{
          gap: 5,
          fontSize: 10.5,
          fontWeight: 600,
          color: 'var(--violet)',
          background: 'var(--violet-dim)',
          padding: '2px 8px',
          borderRadius: 'var(--r-pill)',
        }}
      >
        <Icon.carry size={11} /> {lineageLabel}
        {chessTier && (
          <span
            style={{
              marginLeft: 6,
              padding: '0 6px',
              borderRadius: 'var(--r-xs)',
              background: 'var(--surface-2)',
              color: 'var(--ink-mid)',
              fontWeight: 700,
            }}
          >
            {CHESS_LABEL[chessTier]}
          </span>
        )}
      </span>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 14.5,
          fontWeight: 600,
          lineHeight: 1.35,
          color: 'var(--ink)',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </p>
      {actions && (
        <div className="flex flex-wrap" style={{ gap: 8, marginTop: 10 }}>
          {actions}
        </div>
      )}
    </article>
  );
}
