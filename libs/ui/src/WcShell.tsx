// libs/ui/src/WcShell.tsx — the remote's INTERNAL sub-nav + content region (design shell.jsx, brief §5),
// the re-skin replacement for WcNavigation. A slim, horizontally-scrollable segmented sub-nav — NOT a
// heavy sidebar and NO global chrome (the host app owns its frame). Tabs: My Week · History · Strategy ·
// | · Manager · Settings. Manager is violet, manager-only, carries the unreviewed-count badge, and when
// active opens a 2nd sub-row (Review Queue · Team Dashboard). The active tab is --ink with a 2px --signal
// underline (the .wc-tab[aria-current] rule in global.css). Content sits in a max-1240px region wrapped in
// the .page riseIn transition. Router-agnostic: the parent passes the active group + onNavigate.
import type { ReactNode } from 'react';
import { getIcon } from './icons';

/** Top-level sub-nav group ids (stable; map to routes in the parent). */
export type WcNavId = 'myweek' | 'history' | 'strategy' | 'manager' | 'settings';
/** Manager sub-row ids. */
export type WcManagerSubId = 'mgr-queue' | 'mgr-dashboard';

interface NavDef {
  id: WcNavId;
  label: string;
  icon: string;
  /** Active-state tint as a CSS-var reference. */
  tint: string;
  /** When true, only rendered for managers and visually set apart (violet). */
  manager?: boolean;
}

/** The fixed top-level nav (mirrors shell.jsx NAV). */
const NAV: NavDef[] = [
  { id: 'myweek', label: 'My Week', icon: 'week', tint: 'var(--signal)' },
  { id: 'history', label: 'History', icon: 'history', tint: 'var(--cyan)' },
  { id: 'strategy', label: 'Strategy', icon: 'tree', tint: 'var(--violet)' },
  { id: 'manager', label: 'Manager', icon: 'mgr', tint: 'var(--violet)', manager: true },
  { id: 'settings', label: 'Settings', icon: 'gear', tint: 'var(--amber)' },
];

/** The manager second sub-row (mirrors shell.jsx MGR_SUB). */
const MGR_SUB: { id: WcManagerSubId; label: string }[] = [
  { id: 'mgr-queue', label: 'Review Queue' },
  { id: 'mgr-dashboard', label: 'Team Dashboard' },
];

export interface WcShellProps {
  /** The active top-level group. */
  active: WcNavId;
  /** The active manager sub-row item (only relevant when active === 'manager'). */
  managerSub?: WcManagerSubId;
  /** Whether the current user is a manager (gates the Manager tab + sub-row). */
  isManager?: boolean;
  /** Count of unreviewed reports — shown as a badge on the Manager tab when > 0. */
  unreviewedCount?: number;
  /** Activate a top-level group. */
  onNavigate?: (id: WcNavId) => void;
  /** Activate a manager sub-row item. */
  onNavigateManagerSub?: (id: WcManagerSubId) => void;
  /** The page content (rendered in the max-1240px .page-wrapped content region). */
  children?: ReactNode;
  className?: string;
}

export function WcShell({
  active,
  managerSub = 'mgr-queue',
  isManager = false,
  unreviewedCount = 0,
  onNavigate,
  onNavigateManagerSub,
  children,
  className,
}: WcShellProps): JSX.Element {
  const inManager = active === 'manager';
  const tabs = NAV.filter((n) => !n.manager || isManager);

  return (
    <div className={`wc ${className ?? ''}`.trim()}>
      <nav className="wc-subnav" aria-label="Weekly Commit sections" data-testid="wc-navigation">
        <div className="wc-subnav-inner">
          {tabs.map((n) => {
            const Glyph = getIcon(n.icon);
            const on = active === n.id;
            return (
              <span key={n.id} className="inline-flex items-center">
                {n.manager && <span className="wc-divider" aria-hidden />}
                <button
                  type="button"
                  className={`wc-tab${n.manager ? ' mgr' : ''}`}
                  data-testid={`wc-nav-${n.id}`}
                  aria-current={on ? 'true' : undefined}
                  onClick={() => onNavigate?.(n.id)}
                >
                  <span
                    className="inline-flex"
                    style={{ color: on ? n.tint : 'var(--ink-faint)', transition: 'color .15s' }}
                  >
                    {Glyph && <Glyph size={16} />}
                  </span>{' '}
                  {n.label}
                  {n.manager && unreviewedCount > 0 && (
                    <span
                      className="tab-badge"
                      data-testid="manager-unreviewed-badge"
                      style={{ background: 'var(--violet-dim)', color: 'var(--violet)' }}
                    >
                      {unreviewedCount}
                    </span>
                  )}
                </button>
              </span>
            );
          })}
        </div>

        {inManager && (
          <div style={{ borderTop: '1px solid var(--line-soft)', background: 'var(--surface-2)' }}>
            <div
              className="wc-subnav-inner"
              data-testid="wc-manager-subnav"
              style={{ minHeight: 42, gap: 2 }}
            >
              <span
                className="mono hide-xs"
                style={{
                  fontSize: 9.5,
                  letterSpacing: '0.12em',
                  color: 'var(--violet)',
                  textTransform: 'uppercase',
                  marginRight: 6,
                }}
              >
                Manager
              </span>
              {MGR_SUB.map((s) => {
                const on = managerSub === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-testid={`wc-nav-${s.id}`}
                    aria-current={on ? 'true' : undefined}
                    onClick={() => onNavigateManagerSub?.(s.id)}
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      border: '1px solid',
                      borderColor: on ? 'var(--line-bright)' : 'transparent',
                      background: on ? 'var(--surface-1)' : 'transparent',
                      color: on ? 'var(--ink)' : 'var(--ink-low)',
                      padding: '6px 11px',
                      borderRadius: 'var(--r-sm)',
                      cursor: 'pointer',
                      boxShadow: on ? 'var(--shadow-1)' : 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <div className="wc-content">
        {/* keyed on the active group so React remounts → replays the riseIn page transition */}
        <div className="page" key={active === 'manager' ? `manager-${managerSub}` : active}>
          {children}
        </div>
      </div>
    </div>
  );
}
