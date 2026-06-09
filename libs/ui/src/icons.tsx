// libs/ui/src/icons.tsx — the WCM design inline-SVG icon set (24x24 viewBox, 1.6 stroke, rounded
// caps/joins) faithfully ported from the design handoff (prototype/wcm/icons.jsx). Exports an `Icon`
// map keyed by the design's short names (Icon.week, Icon.lock, Icon.carry, …) AND the legacy PascalCase
// named components (PencilIcon, LockIcon, …) that older primitives import — both render the same paths,
// so nothing in libs/ui or the screens breaks. Icons are aria-hidden by default: they reinforce a text
// label, never stand alone as the only signal (a11y rule from the brief).
import type { SVGProps } from 'react';

/** Props for a single icon. `size` sets both width/height; `sw` overrides the stroke width. */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'fill' | 'stroke'> {
  size?: number;
  /** Stroke width (design default 1.6). */
  sw?: number;
  /** Fill (design default 'none' — these are stroke icons). */
  fill?: string;
}

/** Shared stroke-icon frame: 24x24 viewBox, currentColor stroke, rounded caps/joins, aria-hidden. */
function Frame({
  size = 18,
  sw = 1.6,
  fill = 'none',
  children,
  ...rest
}: IconProps & { children: React.ReactNode }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      {...rest}
    >
      {children}
    </svg>
  );
}

type IconCmp = (props: IconProps) => JSX.Element;

/**
 * The design icon set, keyed by short names (mirrors prototype/wcm/icons.jsx exactly). Use
 * `Icon.lock`, `Icon.carry`, etc. as JSX (`<Icon.lock size={16} />`). Authored with `satisfies` so
 * each member keeps its precise function-component type (usable as a JSX tag); for DYNAMIC lookups by
 * a string key (e.g. a lifecycle/state icon name), use `getIcon(name)` instead of bracket-indexing.
 */
export const Icon = {
  week: (p) => (
    <Frame {...p}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </Frame>
  ),
  history: (p) => (
    <Frame {...p}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4h4" />
      <path d="M12 7.5V12l3 2" />
    </Frame>
  ),
  tree: (p) => (
    <Frame {...p}>
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <rect x="3" y="17" width="6" height="4" rx="1" />
      <rect x="15" y="17" width="6" height="4" rx="1" />
      <path d="M12 7v4M6 17v-2h12v2M12 11v4" />
    </Frame>
  ),
  mgr: (p) => (
    <Frame {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M17 14.5a5.2 5.2 0 0 1 3.5 4.5" />
    </Frame>
  ),
  gear: (p) => (
    <Frame {...p}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.6a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.7-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z" />
    </Frame>
  ),
  check: (p) => (
    <Frame {...p}>
      <path d="M5 12.5 10 17 19 7" />
    </Frame>
  ),
  checkCircle: (p) => (
    <Frame {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2l2.4 2.3 4.6-4.8" />
    </Frame>
  ),
  clock: (p) => (
    <Frame {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Frame>
  ),
  lock: (p) => (
    <Frame {...p}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Frame>
  ),
  unlock: (p) => (
    <Frame {...p}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.5-2" />
    </Frame>
  ),
  pencil: (p) => (
    <Frame {...p}>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="M13.5 6.5l3 3" />
    </Frame>
  ),
  scale: (p) => (
    <Frame {...p}>
      <path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 5a3 3 0 0 0 5 0zM19 8l-2.5 5a3 3 0 0 0 5 0zM12 4l-5 4M12 4l5 4" />
    </Frame>
  ),
  carry: (p) => (
    <Frame {...p}>
      <path d="M4 12h13M12 6l6 6-6 6" />
      <path d="M20 5v14" />
    </Frame>
  ),
  plus: (p) => (
    <Frame {...p}>
      <path d="M12 5v14M5 12h14" />
    </Frame>
  ),
  search: (p) => (
    <Frame {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </Frame>
  ),
  x: (p) => (
    <Frame {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Frame>
  ),
  chevR: (p) => (
    <Frame {...p}>
      <path d="M9 5l7 7-7 7" />
    </Frame>
  ),
  chevD: (p) => (
    <Frame {...p}>
      <path d="M6 9l6 6 6-6" />
    </Frame>
  ),
  chevL: (p) => (
    <Frame {...p}>
      <path d="M15 5l-7 7 7 7" />
    </Frame>
  ),
  arrowR: (p) => (
    <Frame {...p}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Frame>
  ),
  grip: (p) => (
    <Frame {...p}>
      <circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </Frame>
  ),
  trash: (p) => (
    <Frame {...p}>
      <path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 20L18 7" />
    </Frame>
  ),
  flag: (p) => (
    <Frame {...p}>
      <path d="M6 21V4M6 4h11l-2 4 2 4H6" />
    </Frame>
  ),
  comment: (p) => (
    <Frame {...p}>
      <path d="M4 5h16v11H9l-4 3z" />
      <path d="M8 9.5h8M8 13h5" />
    </Frame>
  ),
  mail: (p) => (
    <Frame {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5 12 13l8.5-6.5" />
    </Frame>
  ),
  link: (p) => (
    <Frame {...p}>
      <path d="M10 14a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.3 1.3" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.3-1.3" />
    </Frame>
  ),
  alert: (p) => (
    <Frame {...p}>
      <path d="M12 4 2.5 20h19z" />
      <path d="M12 10v4M12 17h.01" />
    </Frame>
  ),
  info: (p) => (
    <Frame {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </Frame>
  ),
  refresh: (p) => (
    <Frame {...p}>
      <path d="M20 11a8 8 0 0 0-14-4.5L3 9M3 5v4h4M4 13a8 8 0 0 0 14 4.5L21 15M21 19v-4h-4" />
    </Frame>
  ),
  filter: (p) => (
    <Frame {...p}>
      <path d="M4 5h16l-6 7v6l-4 2v-8z" />
    </Frame>
  ),
  dots: (p) => (
    <Frame {...p}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </Frame>
  ),
  sparkle: (p) => (
    <Frame {...p}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </Frame>
  ),
  target: (p) => (
    <Frame {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </Frame>
  ),
  user: (p) => (
    <Frame {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Frame>
  ),
  external: (p) => (
    <Frame {...p}>
      <path d="M14 4h6v6M20 4l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </Frame>
  ),
  sort: (p) => (
    <Frame {...p}>
      <path d="M8 4v16M8 20l-3-3M8 4l3 3M16 20V4M16 4l3 3M16 20l-3-3" />
    </Frame>
  ),
  // 'forward' mirrors the carry-forward arrow used by the lifecycle CARRY_FORWARD badge.
  forward: (p) => (
    <Frame {...p}>
      <path d="M4 12h13M12 6l6 6-6 6" />
      <path d="M20 5v14" />
    </Frame>
  ),
  // 'reconcile' = the cyclic refresh glyph the RECONCILING lifecycle state pairs with.
  reconcile: (p) => (
    <Frame {...p}>
      <path d="M20 11a8 8 0 0 0-14-4.5L3 9M3 5v4h4M4 13a8 8 0 0 0 14 4.5L21 15M21 19v-4h-4" />
    </Frame>
  ),
  // 'spinner' = a generic loading affordance (spins via Tailwind animate-spin).
  spinner: ({ className, ...p }) => (
    <Frame {...p} className={`animate-spin ${className ?? ''}`.trim()}>
      <path d="M12 4a8 8 0 1 0 8 8" />
    </Frame>
  ),
} satisfies Record<string, IconCmp>;

/** Valid icon name (a key of the design set). */
export type IconName = keyof typeof Icon;

/**
 * Dynamic icon lookup by string key — for callers that choose an icon at runtime (lifecycle/state
 * names, etc.). Returns the component or undefined. Use this instead of bracket-indexing `Icon[name]`
 * so the static `<Icon.x />` members keep their precise JSX-component types.
 */
export function getIcon(name: string): IconCmp | undefined {
  return (Icon as Record<string, IconCmp>)[name];
}

// ── Legacy PascalCase named exports (kept stable for primitives/tests that import them) ──

/** Pencil — DRAFT / editable. */
export const PencilIcon: IconCmp = (p) => Icon.pencil(p);
/** Lock — LOCKED / frozen. */
export const LockIcon: IconCmp = (p) => Icon.lock(p);
/** Cyclic refresh — RECONCILING / in progress. */
export const ReconcileIcon: IconCmp = (p) => Icon.reconcile(p);
/** Check-circle — RECONCILED / success / complete. */
export const CheckCircleIcon: IconCmp = (p) => Icon.checkCircle(p);
/** Forward-arrow — CARRY_FORWARD. */
export const ForwardIcon: IconCmp = (p) => Icon.forward(p);
/** Exclamation-triangle — warning / past-due / blocking. */
export const WarningIcon: IconCmp = (p) => Icon.alert(p);
/** Chevron-right — collapsed tree node / breadcrumb separator. */
export const ChevronRightIcon: IconCmp = (p) => Icon.chevR(p);
/** Chevron-down — expanded tree node. */
export const ChevronDownIcon: IconCmp = (p) => Icon.chevD(p);
/** Spinner — generic loading affordance. */
export const SpinnerIcon: IconCmp = (p) => Icon.spinner(p);
/** X-mark — clear / close. */
export const XMarkIcon: IconCmp = (p) => Icon.x(p);
/** Link — RCDO linked chip. */
export const LinkIcon: IconCmp = (p) => Icon.link(p);
/** Plus — add affordance. */
export const PlusIcon: IconCmp = (p) => Icon.plus(p);
/** Refresh — retry. */
export const RefreshIcon: IconCmp = (p) => Icon.refresh(p);
