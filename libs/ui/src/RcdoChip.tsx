// libs/ui/src/RcdoChip.tsx — the RCDO strategy link as a first-class element (brief §4.2), re-skinned
// to the WCM design (prototype/wcm/ui.jsx RcdoChip). LINKED: a green pill (signal-dim fill, link icon,
// truncated Supporting Outcome title) — the optional full ladder shows beneath via RcdoBreadcrumb.
// UNLINKED: an AMBER DASHED "Link a Supporting Outcome" affordance (alert icon + text, never color-only)
// that visibly reads as incomplete so it blocks lock. Backward-compatible props (title/path/onClear) so
// the existing screens keep working; preserves data-testid=rcdo-chip / rcdo-chip-unlinked. Re-exports
// RcdoBreadcrumb + RcdoPath from ./RcdoBreadcrumb so '@wcm/ui' callers importing them stay unchanged.
import type { ReactNode } from 'react';
import { Icon } from './icons';
import { RcdoBreadcrumb } from './RcdoBreadcrumb';
import type { RcdoPath } from './RcdoBreadcrumb';

export interface RcdoChipProps {
  /** Title of the linked Supporting Outcome; null/undefined renders the unlinked affordance. */
  title?: string | null;
  /** Optional full ladder; when present, shown under the linked chip. */
  path?: RcdoPath | null;
  /** Fired when the user clears the link (omit to hide the clear affordance). */
  onClear?: () => void;
  /** Fired when the chip itself is activated (e.g. open the picker). */
  onClick?: () => void;
  className?: string;
}

/**
 * Shows the linked Supporting Outcome as a green chip. When NOT linked, renders the amber dashed
 * "Link a Supporting Outcome" affordance (text + icon, not color-only) so an unlinked item reads as
 * incomplete (brief §4.2). When linked, the chip is a button only if `onClick`/`onClear` are provided.
 */
export function RcdoChip({
  title,
  path,
  onClear,
  onClick,
  className,
}: RcdoChipProps): JSX.Element {
  if (!title) {
    return (
      <button
        type="button"
        onClick={onClick}
        data-testid="rcdo-chip-unlinked"
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 'var(--r-pill)',
          border: '1px dashed var(--amber)',
          background: 'var(--amber-dim)',
          color: 'var(--amber)',
          fontSize: 12,
          fontWeight: 600,
          cursor: onClick ? 'pointer' : 'default',
          maxWidth: '100%',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--sans)',
        }}
      >
        <Icon.alert size={13} aria-hidden />
        Link a Supporting Outcome
      </button>
    );
  }
  return (
    <span
      data-testid="rcdo-chip"
      className={className}
      style={{ display: 'inline-flex', minWidth: 0, flexDirection: 'column', gap: 4 }}
    >
      <ChipButton title={title} onClick={onClick}>
        <Icon.link size={12} aria-hidden />
        <span
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={title}
        >
          {title}
        </span>
        {onClear && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            aria-label={`Clear link to ${title}`}
            style={{
              display: 'inline-flex',
              marginLeft: 2,
              padding: 1,
              border: 'none',
              background: 'transparent',
              color: 'var(--signal-deep)',
              cursor: 'pointer',
              borderRadius: 'var(--r-pill)',
            }}
          >
            <Icon.x size={11} aria-hidden />
          </button>
        )}
      </ChipButton>
      {path && <RcdoBreadcrumb path={path} compact />}
    </span>
  );
}

/** The green linked-chip shell (a button when activatable, an inert span otherwise). */
function ChipButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick?: () => void;
  children: ReactNode;
}): JSX.Element {
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 'var(--r-pill)',
    border: '1px solid color-mix(in oklch, var(--signal) 30%, var(--line))',
    background: 'var(--signal-dim)',
    color: 'var(--signal-deep)',
    fontSize: 12,
    fontWeight: 600,
    maxWidth: '100%',
    minWidth: 0,
    fontFamily: 'var(--sans)',
  } as const;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} style={{ ...style, cursor: 'pointer' }}>
        {children}
      </button>
    );
  }
  return (
    <span title={title} style={style}>
      {children}
    </span>
  );
}
