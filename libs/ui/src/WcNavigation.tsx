// libs/ui/src/WcNavigation.tsx — the remote's INTERNAL sub-nav (brief §5). A slim segmented nav
// (My Week · History · Strategy · Manager · Settings), NOT a heavy sidebar competing with host chrome.
// Manager items are conditional on `isManager`; the active item carries aria-current="page". Routing-
// agnostic: parent passes the active path + an onNavigate, so it works with any router (the app wires
// react-router). Renders as a semantic <nav> with a tablist-free, link-style list for AT clarity.
import type { ReactNode } from 'react';

export interface WcNavItem {
  /** Stable route path, e.g. "/" or "/history". */
  to: string;
  /** Human-readable label (never an internal slug). */
  label: string;
  /** When true, only shown to managers. */
  managerOnly?: boolean;
  /** Optional leading icon. */
  icon?: ReactNode;
}

/** The default WC internal navigation (brief §5 IA). */
export const DEFAULT_WC_NAV: WcNavItem[] = [
  { to: '/', label: 'My Week' },
  { to: '/history', label: 'History' },
  { to: '/strategy', label: 'Strategy' },
  { to: '/manager', label: 'Manager', managerOnly: true },
  { to: '/settings', label: 'Settings' },
];

export interface WcNavigationProps {
  /** The currently-active route path (parent supplies from the router). */
  activePath: string;
  /** Whether the current user is a manager (gates manager-only items). */
  isManager?: boolean;
  /** Called with the item's `to` when an item is activated. */
  onNavigate?: (to: string) => void;
  /** Override the default items. */
  items?: WcNavItem[];
  className?: string;
}

/** True when `to` is the active path (root "/" matches exactly; others match a prefix). */
function isActive(to: string, activePath: string): boolean {
  if (to === '/') return activePath === '/';
  return activePath === to || activePath.startsWith(`${to}/`);
}

export function WcNavigation({
  activePath,
  isManager = false,
  onNavigate,
  items = DEFAULT_WC_NAV,
  className,
}: WcNavigationProps): JSX.Element {
  const visible = items.filter((i) => !i.managerOnly || isManager);
  return (
    <nav
      aria-label="Weekly Commit sections"
      data-testid="wc-navigation"
      className={`flex flex-wrap gap-1 border-b border-slate-200 ${className ?? ''}`.trim()}
    >
      {visible.map((item) => {
        const active = isActive(item.to, activePath);
        return (
          <a
            key={item.to}
            href={item.to}
            data-testid={`wc-nav-${item.to}`}
            aria-current={active ? 'page' : undefined}
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault();
                onNavigate(item.to);
              }
            }}
            className={[
              'inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition',
              active
                ? 'border-accent-500 text-primary-800'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
            ].join(' ')}
          >
            {item.icon}
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
