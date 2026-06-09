// libs/ui/src/CarriedForwardCard.tsx — surfaces an item brought from last week with its lineage
// ("Carried from last week"), per brief §6.2/§6.3. Distinct treatment + forward icon (text, not
// color-only). Optional per-item actions (mark complete / carry forward / drop) render as children.
import type { ReactNode } from 'react';
import type { ChessTier } from '@wcm/types';
import { ForwardIcon } from './icons';
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
      data-testid="carried-forward-card"
      className={`rounded border-l-4 border-accent-400 bg-accent-50/60 px-4 py-3 ${className ?? ''}`.trim()}
    >
      <div className="flex items-start gap-2">
        <ForwardIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-medium text-accent-700">
            {lineageLabel}
            {chessTier && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                {CHESS_LABEL[chessTier]}
              </span>
            )}
          </p>
          <p className="mt-0.5 break-words text-sm text-slate-800">{text}</p>
          {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </article>
  );
}
