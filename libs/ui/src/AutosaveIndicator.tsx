// libs/ui/src/AutosaveIndicator.tsx — the Draft-screen autosave status ("Saved · just now") from brief
// §4.1, re-skinned to the WCM design (prototype/wcm/ui.jsx Autosave): a small mono, letter-spaced status
// — an amber pulsing dot while saving, a green check + "Saved · {label}" when saved, a red alert while
// erroring, and a still amber dot + "Changes pending" while edits are HELD locally (e.g. a blank item
// the server would reject — the parent skips the network but must not claim "saved"). A polite live
// region announces save state to AT; status is text + icon/dot, never color-only. Pure/presentational:
// the parent owns the save lifecycle. Preserves data-testid=autosave-indicator, data-status,
// role=status, aria-live=polite + the exact status copy the screens/tests rely on.
import { Icon } from './icons';

export type AutosaveStatus = 'idle' | 'saving' | 'pending' | 'saved' | 'error';

export interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  /** When status==='saved', a relative label like "just now" (parent computes it). */
  savedLabel?: string;
  className?: string;
}

interface Content {
  node: JSX.Element;
  text: string;
  color: string;
}

function contentFor(status: AutosaveStatus, savedLabel: string): Content {
  switch (status) {
    case 'saving':
      return {
        node: <span className="dot live-pulse" style={{ background: 'var(--amber)' }} aria-hidden />,
        text: 'Saving…',
        color: 'var(--ink-low)',
      };
    case 'pending':
      // Edits exist but are deliberately NOT persisted yet (the parent is holding an invalid
      // payload locally). A steady amber dot — present, not in flight, and never "saved".
      return {
        node: <span className="dot" style={{ background: 'var(--amber)' }} aria-hidden />,
        text: 'Changes pending',
        color: 'var(--ink-low)',
      };
    case 'saved':
      return {
        node: <Icon.check size={13} style={{ color: 'var(--signal)' }} aria-hidden />,
        text: `Saved · ${savedLabel}`,
        color: 'var(--ink-low)',
      };
    case 'error':
      return {
        node: <Icon.alert size={13} style={{ color: 'var(--red)' }} aria-hidden />,
        text: 'Could not save — retrying',
        color: 'var(--red)',
      };
    case 'idle':
    default:
      return {
        node: <Icon.check size={13} style={{ color: 'var(--ink-faint)' }} aria-hidden />,
        text: 'All changes saved',
        color: 'var(--ink-low)',
      };
  }
}

export function AutosaveIndicator({
  status,
  savedLabel = 'just now',
  className,
}: AutosaveIndicatorProps): JSX.Element {
  const { node, text, color } = contentFor(status, savedLabel);
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="autosave-indicator"
      data-status={status}
      className={`mono ${className ?? ''}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10.5,
        letterSpacing: '0.04em',
        color,
      }}
    >
      {node}
      <span>{text}</span>
    </span>
  );
}
