// libs/ui/src/StatePrimitives.tsx — the shared async-surface states every RTK Query screen needs
// (brief §4.4): layout-preserving Skeleton (CLS-safe), friendly Empty with a next action, and a
// retryable Error. Reused across My Week, history, reconciliation, manager surfaces — not per-screen.
import type { ReactNode } from 'react';
import { Button } from 'flowbite-react';
import { WarningIcon } from './icons';

export interface SkeletonProps {
  /** Number of placeholder lines/blocks to reserve. */
  lines?: number;
  /** Tailwind height per line. */
  lineHeight?: string;
  className?: string;
}

/** A shimmer placeholder that reserves layout space so async content causes no layout shift. */
export function Skeleton({
  lines = 3,
  lineHeight = 'h-4',
  className,
}: SkeletonProps): JSX.Element {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid="skeleton"
      className={`animate-pulse space-y-3 ${className ?? ''}`.trim()}
    >
      <span className="sr-only">Loading…</span>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`${lineHeight} rounded bg-slate-200`}
          style={{ width: `${90 - (i % 3) * 12}%` }}
        />
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Primary next-action (e.g. "Start your week"). */
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** Friendly empty state that always offers the next action (brief §4.4). */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps): JSX.Element {
  return (
    <div
      data-testid="empty-state"
      className={`flex flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center ${className ?? ''}`.trim()}
    >
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Retry handler — when present, a "Try again" button is shown. */
  onRetry?: () => void;
  className?: string;
}

/** Clear, retryable error surface (brief §4.4). role=alert + icon (never color-only). */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this right now.',
  onRetry,
  className,
}: ErrorStateProps): JSX.Element {
  return (
    <div
      role="alert"
      data-testid="error-state"
      className={`flex flex-col items-center justify-center rounded border border-red-200 bg-red-50 px-6 py-10 text-center ${className ?? ''}`.trim()}
    >
      <WarningIcon className="mb-2 h-8 w-8 text-danger" aria-hidden />
      <h3 className="text-sm font-semibold text-red-800">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-red-700">{description}</p>
      {onRetry && (
        <Button
          color="failure"
          size="xs"
          className="mt-4"
          onClick={onRetry}
          data-testid="error-retry"
        >
          Try again
        </Button>
      )}
    </div>
  );
}
