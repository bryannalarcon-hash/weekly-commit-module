// libs/ui/src/StatePrimitives.tsx — the shared async-surface states every RTK Query screen needs
// (brief §4.4), re-skinned to the WCM design (prototype/wcm/ui.jsx SkLine/EmptyState/ErrorState): a
// layout-preserving shimmer Skeleton (uses the global .sk class — CLS-safe, reserves N lines), a
// friendly EmptyState (signal-tinted icon tile + a next action), and a retryable ErrorState (red-tinted
// alert icon + Retry). Reused across My Week, history, reconciliation, manager surfaces — not per-screen.
// Preserves testids: skeleton, empty-state, error-state, error-retry. Icon + text always carry meaning
// (never color-only). Buttons use the global .btn-* utility classes.
import type { ReactNode } from 'react';
import { getIcon, Icon } from './icons';

export interface SkeletonProps {
  /** Number of placeholder lines/blocks to reserve (reserves layout space → no shift). */
  lines?: number;
  /** Per-line height in px. */
  lineHeight?: number;
  className?: string;
}

/** A shimmer placeholder that reserves layout space so async content causes no layout shift. */
export function Skeleton({ lines = 3, lineHeight = 14, className }: SkeletonProps): JSX.Element {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid="skeleton"
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Loading…
      </span>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="sk"
          style={{ height: lineHeight, width: `${90 - (i % 3) * 12}%` }}
        />
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Primary next-action (e.g. a "Start your week" button). */
  action?: ReactNode;
  /** Icon key from the design icon set (default "sparkle"). */
  icon?: string;
  className?: string;
}

/** Friendly empty state that always offers the next action (brief §4.4). */
export function EmptyState({
  title,
  description,
  action,
  icon = 'sparkle',
  className,
}: EmptyStateProps): JSX.Element {
  const Glyph = getIcon(icon) ?? Icon.sparkle;
  return (
    <div
      data-testid="empty-state"
      className={`panel ${className ?? ''}`.trim()}
      style={{
        padding: '48px 28px',
        textAlign: 'center',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--line)',
        background: 'var(--surface-1)',
        boxShadow: 'var(--shadow-1)',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 'var(--r-md)',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 16px',
          background: 'var(--signal-dim)',
          color: 'var(--signal-deep)',
        }}
      >
        {Glyph?.({ size: 26 })}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {description && (
        <div
          style={{
            fontSize: 13.5,
            color: 'var(--ink-low)',
            maxWidth: 360,
            margin: '0 auto 18px',
            lineHeight: 1.55,
          }}
        >
          {description}
        </div>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Retry handler — when present, a "Retry" button is shown. */
  onRetry?: () => void;
  className?: string;
}

/** Clear, retryable error surface (brief §4.4). role=alert + icon (never color-only). */
export function ErrorState({
  title = 'Something went wrong',
  description = "We couldn't load this. Check your connection and try again.",
  onRetry,
  className,
}: ErrorStateProps): JSX.Element {
  return (
    <div
      role="alert"
      data-testid="error-state"
      className={`panel ${className ?? ''}`.trim()}
      style={{
        padding: '44px 28px',
        textAlign: 'center',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--line)',
        background: 'var(--surface-1)',
        boxShadow: 'var(--shadow-1)',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 'var(--r-md)',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 16px',
          background: 'var(--red-dim)',
          color: 'var(--red)',
        }}
      >
        <Icon.alert size={26} aria-hidden />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div
        style={{
          fontSize: 13.5,
          color: 'var(--ink-low)',
          maxWidth: 360,
          margin: '0 auto 18px',
          lineHeight: 1.55,
        }}
      >
        {description}
      </div>
      {onRetry && (
        <button type="button" className="btn btn-ghost" data-testid="error-retry" onClick={onRetry}>
          <Icon.refresh size={15} aria-hidden /> Retry
        </button>
      )}
    </div>
  );
}
