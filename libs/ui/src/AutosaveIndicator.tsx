// libs/ui/src/AutosaveIndicator.tsx — the Draft-screen autosave status ("Saved · just now") from
// brief §4.1. A polite live region announces save state to AT; status is text + icon, never color-only.
// Pure/presentational: the parent owns the save lifecycle and passes the status + optional savedAt.
import { CheckCircleIcon, SpinnerIcon, WarningIcon } from './icons';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  /** When status==='saved', a relative label like "just now" (parent computes it). */
  savedLabel?: string;
  className?: string;
}

function content(status: AutosaveStatus, savedLabel: string): {
  icon: JSX.Element;
  text: string;
  tone: string;
} {
  switch (status) {
    case 'saving':
      return {
        icon: <SpinnerIcon className="h-3.5 w-3.5" aria-hidden />,
        text: 'Saving…',
        tone: 'text-slate-500',
      };
    case 'saved':
      return {
        icon: <CheckCircleIcon className="h-3.5 w-3.5 text-success" aria-hidden />,
        text: `Saved · ${savedLabel}`,
        tone: 'text-slate-600',
      };
    case 'error':
      return {
        icon: <WarningIcon className="h-3.5 w-3.5 text-danger" aria-hidden />,
        text: 'Could not save — retrying',
        tone: 'text-danger',
      };
    case 'idle':
    default:
      return {
        icon: <CheckCircleIcon className="h-3.5 w-3.5 text-slate-400" aria-hidden />,
        text: 'All changes saved',
        tone: 'text-slate-500',
      };
  }
}

export function AutosaveIndicator({
  status,
  savedLabel = 'just now',
  className,
}: AutosaveIndicatorProps): JSX.Element {
  const { icon, text, tone } = content(status, savedLabel);
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="autosave-indicator"
      data-status={status}
      className={`inline-flex items-center gap-1.5 text-xs ${tone} ${className ?? ''}`.trim()}
    >
      {icon}
      <span>{text}</span>
    </span>
  );
}
