// libs/ui/src/CommitItemRow.tsx — the reusable commit-item row in BOTH modes (design components.jsx
// <CommitItemRow>). READ mode: chess glyph (ChessBadge) + title + RcdoChip + the 4-level breadcrumb,
// optional done-checkbox and right slot. EDIT (composer) mode: a keyboard drag-grip, an inline title
// input, the ChessSelector, the "link/change outcome" control, and delete. The left rail reads
// green when linked to a Supporting Outcome / amber when not (reinforced by the RcdoChip's text,
// never color-only). Presentational: the parent (EditCommit/MyWeek) owns the data + the callbacks.
//
// Preserves the load-bearing Cypress/RTL testids the composer depends on: composer-item (row),
// item-text (title input), link-outcome (open-picker control), delete-item, drag-handle. Primitives:
// ChessBadge (./ChessBadge), ChessSelector (./ChessSelector), RcdoChip (./RcdoChip), and
// RcdoBreadcrumb/RcdoPath (./RcdoBreadcrumb). The RcdoChip is also a picker trigger (its onClick mirrors
// link-outcome) for design fidelity.
import type { ReactNode } from 'react';
import type { ChessTier } from '@wcm/types';
import { ChessBadge } from './ChessBadge';
import { ChessSelector } from './ChessSelector';
import { RcdoChip } from './RcdoChip';
import { RcdoBreadcrumb, type RcdoPath } from './RcdoBreadcrumb';
import { Icon } from './icons';

export interface CommitItemRowProps {
  /** Stable item id (mirrored to data-item-id for reorder/drag bookkeeping). */
  id: string;
  /** The item's text (read-only display, or the value of the inline input in edit mode). */
  text: string;
  /** Priority tier (drives the chess glyph in read mode / the selected radio in edit mode). */
  tier?: ChessTier | null;
  /** Title of the linked Supporting Outcome (null/undefined when unlinked). */
  outcomeTitle?: string | null;
  /** Optional full RCDO breadcrumb (shown under the title in read mode when linked). */
  outcomePath?: RcdoPath | null;
  /** When set, shows a "Carried from {label}" lineage pill above the title. */
  carriedFromLabel?: string | null;
  /** Edit (composer) mode vs. read-only mode. */
  editable?: boolean;
  /** Show a leading done-toggle (read views that allow marking complete). */
  showDone?: boolean;
  /** Whether the item is marked done (strikes the title; fills the toggle). */
  done?: boolean;
  /** Override the left-rail accent (defaults to signal-if-linked / amber-if-not). */
  accent?: string;

  // --- edit-mode callbacks ---
  onTextChange?: (text: string) => void;
  onTierChange?: (tier: ChessTier) => void;
  onOpenPicker?: () => void;
  onClearLink?: () => void;
  onDelete?: () => void;
  // --- read-mode callbacks ---
  onToggleDone?: () => void;

  /** Optional right-aligned slot (status pill, review controls). */
  right?: ReactNode;
  /** Drag-handle wiring (e.g. @dnd-kit attributes/listeners) spread onto the grip button. */
  dragHandleProps?: Record<string, unknown>;
  className?: string;
}

export function CommitItemRow({
  id,
  text,
  tier,
  outcomeTitle,
  outcomePath,
  carriedFromLabel,
  editable = false,
  showDone = false,
  done = false,
  accent,
  onTextChange,
  onTierChange,
  onOpenPicker,
  onClearLink,
  onDelete,
  onToggleDone,
  right,
  dragHandleProps,
  className,
}: CommitItemRowProps): JSX.Element {
  const linked = Boolean(outcomeTitle);
  const leftColor = accent ?? (linked ? 'var(--signal)' : 'var(--amber)');

  return (
    <li
      data-testid="composer-item"
      data-item-id={id}
      className={`panel flex ${className ?? ''}`.trim()}
      style={{
        gap: 12,
        padding: '13px 15px',
        borderLeft: `3px solid ${leftColor}`,
        alignItems: 'flex-start',
        listStyle: 'none',
      }}
    >
      {editable && (
        <button
          type="button"
          {...dragHandleProps}
          data-testid="drag-handle"
          aria-label={`Reorder “${text || 'new item'}”`}
          className="grip touch-none"
          style={{
            color: 'var(--ink-faint)',
            background: 'none',
            border: 'none',
            cursor: 'grab',
            padding: '3px 0',
            marginTop: 2,
          }}
        >
          <Icon.grip size={16} />
        </button>
      )}

      {showDone && (
        <button
          type="button"
          onClick={onToggleDone}
          aria-pressed={done}
          aria-label="Toggle complete"
          className="grid place-items-center"
          style={{
            width: 22,
            height: 22,
            marginTop: 1,
            flex: 'none',
            borderRadius: 'var(--r-xs)',
            cursor: 'pointer',
            background: done ? 'var(--signal)' : 'var(--surface-1)',
            border: `1.5px solid ${done ? 'var(--signal)' : 'var(--line-bright)'}`,
            color: '#fff',
          }}
        >
          {done && <Icon.check size={13} sw={2.6} />}
        </button>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {carriedFromLabel && (
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
              marginBottom: 7,
            }}
          >
            <Icon.carry size={11} /> Carried from {carriedFromLabel}
          </span>
        )}

        <div className="flex items-start" style={{ gap: 10 }}>
          {!editable && tier && (
            <span style={{ marginTop: 1 }}>
              <ChessBadge tier={tier} showLabel={false} />
            </span>
          )}
          {editable ? (
            <input
              className="input"
              data-testid="item-text"
              value={text}
              onChange={(e) => onTextChange?.(e.target.value)}
              placeholder="What will you commit to this week?"
              aria-label="Commit item text"
              style={{
                fontWeight: 600,
                fontSize: 14.5,
                border: '1px solid transparent',
                background: 'transparent',
                padding: '2px 4px',
                marginLeft: -4,
              }}
            />
          ) : (
            <span
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                lineHeight: 1.35,
                textDecoration: done ? 'line-through' : 'none',
                color: done ? 'var(--ink-low)' : 'var(--ink)',
              }}
            >
              {text}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center" style={{ marginTop: 9, gap: 10 }}>
          {editable && (
            <ChessSelector value={tier ?? null} onChange={(t) => onTierChange?.(t)} />
          )}
          <RcdoChip
            title={outcomeTitle ?? null}
            onClick={onOpenPicker}
            onClear={linked && onClearLink ? onClearLink : undefined}
          />
          {editable && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              data-testid="link-outcome"
              onClick={onOpenPicker}
            >
              {linked ? 'Change outcome' : 'Link outcome'}
            </button>
          )}
        </div>

        {!editable && linked && outcomePath && (
          <div style={{ marginTop: 8 }}>
            <RcdoBreadcrumb path={outcomePath} />
          </div>
        )}
      </div>

      <div className="flex items-center" style={{ gap: 8, flex: 'none' }}>
        {right}
        {editable && (
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            data-testid="delete-item"
            aria-label="Delete item"
            onClick={onDelete}
            style={{ color: 'var(--ink-faint)', padding: 7 }}
          >
            <Icon.trash size={16} />
          </button>
        )}
      </div>
    </li>
  );
}
