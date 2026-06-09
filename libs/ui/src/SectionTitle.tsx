// libs/ui/src/SectionTitle.tsx — the small in-page section header (design components.jsx <SectionTitle>):
// an optional mono "kicker" eyebrow above an h2, with an optional right-aligned slot (filters, links,
// "view all"). Pure presentational layout using the .kicker token utility + the .between flex helper
// from the global stylesheet. Reused across My Week, history, manager and reconciliation surfaces.
import type { ReactNode } from 'react';

export interface SectionTitleProps {
  /** Optional uppercase mono eyebrow above the title. */
  kicker?: ReactNode;
  /** The section heading text (rendered as an h2). */
  title: ReactNode;
  /** Optional right-aligned controls (link, filter, count). */
  right?: ReactNode;
  className?: string;
}

export function SectionTitle({
  kicker,
  title,
  right,
  className,
}: SectionTitleProps): JSX.Element {
  return (
    <div
      data-testid="section-title"
      className={`between ${className ?? ''}`.trim()}
      style={{ marginBottom: 14, alignItems: 'flex-end' }}
    >
      <div>
        {kicker && (
          <div className="kicker" style={{ marginBottom: 4 }}>
            {kicker}
          </div>
        )}
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap' }}>{title}</h2>
      </div>
      {right}
    </div>
  );
}
