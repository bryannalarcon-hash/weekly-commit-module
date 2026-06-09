// libs/ui/src/ConfirmDialog.tsx — the Submit/Lock confirmation dialog (brief §7), re-skinned to the WCM
// design (prototype/wcm/ui.jsx ConfirmDialog): a centered modal inside the shared Scrim (Esc / click-out
// close) with a tinted icon tile, a title + consequence body, and a footer (Cancel + a primary or danger
// confirm). Supports a busy in-flight state (disables both actions). Renders NOTHING when closed.
// Backward-compatible props (open/title/children/confirmLabel/cancelLabel/busy/destructive/onConfirm/
// onCancel) + testids (confirm-dialog / confirm-accept / confirm-cancel) so the existing screens keep working.
import type { ReactNode } from 'react';
import { getIcon, Icon } from './icons';
import { Scrim } from './Scrim';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Body explaining the consequence of confirming. */
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** True while the confirmed action is in flight (disables buttons). */
  busy?: boolean;
  /** Renders the confirm button as destructive (red). */
  destructive?: boolean;
  /** Icon key from the design set for the header tile (default "lock"). */
  icon?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  destructive = false,
  icon = 'lock',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null {
  if (!open) return null;
  const Glyph = getIcon(icon) ?? Icon.lock;
  return (
    <Scrim onClose={busy ? () => undefined : onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="confirm-dialog"
        style={{
          width: 440,
          maxWidth: '92vw',
          borderRadius: 'var(--r-md)',
          background: 'var(--surface-1)',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow-pop)',
          animation: 'riseIn .2s ease both',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '22px 22px 18px' }}>
          <div style={{ display: 'flex', gap: 13 }}>
            <span
              style={{
                width: 40,
                height: 40,
                flex: 'none',
                borderRadius: 'var(--r-sm)',
                display: 'grid',
                placeItems: 'center',
                background: destructive ? 'var(--red-dim)' : 'var(--cyan-dim)',
                color: destructive ? 'var(--red)' : 'var(--cyan)',
              }}
            >
              {Glyph?.({ size: 20 })}
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 5 }}>{title}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-mid)', lineHeight: 1.55 }}>
                {children}
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 9,
            padding: '14px 18px',
            borderTop: '1px solid var(--line-soft)',
            background: 'var(--surface-2)',
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            data-testid="confirm-cancel"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`}
            data-testid="confirm-accept"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy && <Icon.spinner size={15} aria-hidden />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Scrim>
  );
}
