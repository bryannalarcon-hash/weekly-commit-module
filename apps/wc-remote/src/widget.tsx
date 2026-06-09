// apps/wc-remote/src/widget.tsx — the federated DASHBOARD WIDGET of the WC remote, exposed to a host as
// './WeeklyCommitWidget' (alongside the full './WeeklyCommitApp'). A self-contained tile a host embeds on
// its own dashboard: it owns its data (RTK Query useGetCurrentWeekQuery, wrapped in its own AppProviders
// store so it mounts standalone) and calls back via onOpen(route) to ask the host to navigate into the
// full module. Re-skinned to the WCM c-design (prototype/wcm/widget.jsx) with two variants:
//   • 'card' (default) — lifecycle top-stripe, "This week" + range + LifecycleBadge, a linked/total
//     progress ring, "Ready to lock" / "N need a link", the top-3 items (chess glyph + title + link/alert
//     icon, "+N more"), the due date, and a contextual CTA (Finish & lock for a Draft, else Open).
//   • 'compact' — a slim status strip (lifecycle icon + "This week" + n/total + lifecycle label), one tap.
// Data via RTK Query ONLY (no fetch/axios). Lifecycle color/icon/label come from LIFECYCLE_VISUAL, chess
// glyphs from CHESS_GLYPH (both @wcm/ui) so the scheme stays swappable. testids: wcm-widget, widget-card,
// widget-compact, widget-cta (+ loading/empty/error skeleton states).
import { useRef } from 'react';
import type { CommitDto, CommitItemDto } from '@wcm/types';
import { makeStore, useGetCurrentWeekQuery, type AppStore } from '@wcm/api';
import {
  CHESS_GLYPH,
  ErrorState,
  Icon,
  LifecycleBadge,
  LIFECYCLE_VISUAL,
  Skeleton,
} from '@wcm/ui';
import { AppProviders } from './app/AppProviders';
import { formatWeekRange, parseIsoDate } from './lib/week';

/** A route hint the host maps to its own navigation when the viewer opens the full module. */
export type WidgetRoute = 'myweek' | 'edit';

export interface WeeklyCommitWidgetProps {
  /** Host navigation callback — invoked with the route the viewer wants to open. */
  onOpen?: (route: WidgetRoute) => void;
  /** 'card' (default, a dashboard tile) or 'compact' (a slim status strip). */
  variant?: 'card' | 'compact';
  /**
   * Optional pre-fetched commit. When omitted the widget self-fetches via RTK Query (and wraps itself
   * in its own provider so a host can mount it standalone without the remote's app shell).
   */
  week?: CommitDto | null;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "Jun 8–12" — the bare range the design shows (no "Week of " prefix). */
function shortRange(weekStartIso: string): string {
  return formatWeekRange(weekStartIso)
    .replace(/^Week of /, '')
    .replace(/\s–\s/, '–');
}

/** "Fri Jun 12" — the Friday due date for a Mon-start week (the design's due line). */
function shortDue(weekStartIso: string): string {
  const friday = parseIsoDate(weekStartIso);
  friday.setDate(friday.getDate() + 4);
  const wd = WEEKDAYS[friday.getDay()] ?? '';
  const mo = MONTHS[friday.getMonth()] ?? '';
  return `${wd} ${mo} ${friday.getDate()}`;
}

/** A week is past its Friday while still an editable Draft (drives the red due line). */
function isOverdue(commit: CommitDto, now: Date = new Date()): boolean {
  if (commit.lifecycleState !== 'DRAFT') return false;
  const friday = parseIsoDate(commit.weekStart);
  friday.setDate(friday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return now.getTime() > friday.getTime();
}

interface Counts {
  linked: number;
  total: number;
  pct: number;
  ready: boolean;
}

function countLinks(items: CommitItemDto[]): Counts {
  const total = items.length;
  const linked = items.filter((i) => i.supportingOutcomeId).length;
  const pct = total ? Math.round((linked / total) * 100) : 0;
  return { linked, total, pct, ready: total > 0 && linked === total };
}

interface RingProps {
  pct: number;
  color: string;
  size?: number;
  stroke?: number;
}

/** The linked/total progress ring (SVG); a11y-hidden — the numbers beside it carry the meaning. */
function ProgressRing({
  pct,
  color,
  size = 46,
  stroke = 5,
}: RingProps): JSX.Element {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      data-testid="widget-ring"
      style={{ flex: 'none' }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--surface-3)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
    </svg>
  );
}

/** The CTA destination + label for a given lifecycle: Draft → finish & lock the plan, else open it. */
function ctaFor(state: CommitDto['lifecycleState']): {
  route: WidgetRoute;
  label: string;
} {
  return state === 'DRAFT'
    ? { route: 'edit', label: 'Finish & lock' }
    : { route: 'myweek', label: 'Open' };
}

/** The COMPACT variant — a slim, single-tap status strip for a host top-bar / list. */
function CompactStrip({
  commit,
  onOpen,
}: {
  commit: CommitDto;
  onOpen: (route: WidgetRoute) => void;
}): JSX.Element {
  const { linked, total } = countLinks(commit.items);
  const lc = LIFECYCLE_VISUAL[commit.lifecycleState];
  const LcIcon = Icon[lc.icon];
  return (
    <button
      type="button"
      data-testid="widget-compact"
      onClick={() => onOpen('myweek')}
      aria-label={`Weekly commit, ${lc.label}, ${linked} of ${total} linked. Open module.`}
      className="lift"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        width: '100%',
        textAlign: 'left',
        background: 'var(--surface-1)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: '11px 14px',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-1)',
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 'var(--r-sm)',
          background: lc.dim,
          color: lc.color,
          display: 'grid',
          placeItems: 'center',
          flex: 'none',
        }}
      >
        <LcIcon size={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>This week</span>
          <span
            className="mono"
            style={{ fontSize: 10, color: 'var(--ink-low)' }}
          >
            {shortRange(commit.weekStart)}
          </span>
        </span>
        <span
          className="mono tnum"
          style={{ fontSize: 11, color: 'var(--ink-low)' }}
        >
          {linked}/{total} linked · {lc.label}
        </span>
      </span>
      <Icon.chevR
        size={16}
        style={{ color: 'var(--ink-faint)', flex: 'none' }}
      />
    </button>
  );
}

/** The CARD variant — a dashboard tile a host embeds. */
function WidgetCard({
  commit,
  onOpen,
}: {
  commit: CommitDto;
  onOpen: (route: WidgetRoute) => void;
}): JSX.Element {
  const { linked, total, pct, ready } = countLinks(commit.items);
  const lc = LIFECYCLE_VISUAL[commit.lifecycleState];
  const overdue = isOverdue(commit);
  const needLink = total - linked;
  const cta = ctaFor(commit.lifecycleState);

  return (
    <section
      data-testid="widget-card"
      aria-label="Weekly Commit widget"
      style={{
        width: '100%',
        background: 'var(--surface-1)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-1)',
        overflow: 'hidden',
      }}
    >
      {/* lifecycle top-stripe */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${lc.color}, color-mix(in oklch, ${lc.color} 40%, transparent))`,
        }}
      />
      <div style={{ padding: '16px 18px' }}>
        <header className="between" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: 'var(--signal)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <span
                className="mono"
                style={{ color: '#fff', fontWeight: 700, fontSize: 10 }}
              >
                WC
              </span>
            </span>
            <div style={{ lineHeight: 1.05 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>This week</div>
              <div
                className="mono"
                style={{ fontSize: 9.5, color: 'var(--ink-low)' }}
              >
                {shortRange(commit.weekStart)}
              </div>
            </div>
          </div>
          <LifecycleBadge state={commit.lifecycleState} size="sm" />
        </header>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 14,
          }}
        >
          <ProgressRing
            pct={pct}
            color={ready ? 'var(--signal)' : 'var(--amber)'}
          />
          <div>
            <div
              className="tnum"
              style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}
            >
              {linked}
              <span style={{ color: 'var(--ink-faint)', fontWeight: 500 }}>
                /{total}
              </span>{' '}
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'var(--ink-low)',
                }}
              >
                linked to strategy
              </span>
            </div>
            <div
              data-testid="widget-readiness"
              style={{
                fontSize: 12,
                color: ready ? 'var(--signal-deep)' : 'var(--amber)',
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontWeight: 600,
              }}
            >
              {ready ? (
                <>
                  <Icon.checkCircle size={13} /> Ready to lock
                </>
              ) : (
                <>
                  <Icon.alert size={13} /> {needLink} item
                  {needLink !== 1 ? 's' : ''} need a link
                </>
              )}
            </div>
          </div>
        </div>

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {commit.items.slice(0, 3).map((item) => {
            const itemLinked = Boolean(item.supportingOutcomeId);
            return (
              <li
                key={item.id}
                data-testid="widget-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '7px 9px',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--r-sm)',
                  borderLeft: `2px solid ${itemLinked ? 'var(--signal)' : 'var(--amber)'}`,
                }}
              >
                {item.chessTier && (
                  <span
                    aria-hidden
                    style={{ fontSize: 13, opacity: 0.6, flex: 'none' }}
                  >
                    {CHESS_GLYPH[item.chessTier]}
                  </span>
                )}
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12.5,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.text}
                </span>
                {itemLinked ? (
                  <Icon.link
                    size={12}
                    style={{ color: 'var(--signal)', flex: 'none' }}
                    aria-label="Linked"
                  />
                ) : (
                  <Icon.alert
                    size={12}
                    style={{ color: 'var(--amber)', flex: 'none' }}
                    aria-label="Unlinked"
                  />
                )}
              </li>
            );
          })}
          {commit.items.length > 3 && (
            <li
              className="mono"
              style={{
                fontSize: 10.5,
                color: 'var(--ink-low)',
                padding: '2px 9px',
              }}
            >
              +{commit.items.length - 3} more
            </li>
          )}
        </ul>

        <div className="between" style={{ marginTop: 14, gap: 10 }}>
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              color: overdue ? 'var(--red)' : 'var(--ink-low)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Icon.clock size={12} /> Due {shortDue(commit.weekStart)}
          </span>
          <button
            type="button"
            data-testid="widget-cta"
            className="btn btn-primary btn-sm lift"
            onClick={() => onOpen(cta.route)}
          >
            {cta.label} <Icon.arrowR size={13} />
          </button>
        </div>
      </div>
    </section>
  );
}

/** The empty state: the viewer has no commit this week yet — invite them into the composer. */
function WidgetEmpty({
  variant,
  onOpen,
}: {
  variant: 'card' | 'compact';
  onOpen: (route: WidgetRoute) => void;
}): JSX.Element {
  if (variant === 'compact') {
    return (
      <button
        type="button"
        data-testid="widget-compact"
        onClick={() => onOpen('myweek')}
        aria-label="No weekly commit yet. Start this week."
        className="lift"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          width: '100%',
          textAlign: 'left',
          background: 'var(--surface-1)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)',
          padding: '11px 14px',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-1)',
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface-2)',
            color: 'var(--ink-low)',
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
          }}
        >
          <Icon.week size={17} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>This week</span>
          <span
            className="mono"
            style={{ display: 'block', fontSize: 11, color: 'var(--ink-low)' }}
          >
            Not started
          </span>
        </span>
        <Icon.chevR
          size={16}
          style={{ color: 'var(--ink-faint)', flex: 'none' }}
        />
      </button>
    );
  }
  return (
    <section
      data-testid="widget-card"
      aria-label="Weekly Commit widget"
      style={{
        width: '100%',
        background: 'var(--surface-1)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-1)',
        overflow: 'hidden',
      }}
    >
      <div style={{ height: 3, background: 'var(--line)' }} />
      <div style={{ padding: '20px 18px', textAlign: 'center' }}>
        <div
          style={{
            width: 36,
            height: 36,
            margin: '0 auto 10px',
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface-2)',
            color: 'var(--ink-low)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon.week size={18} />
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>
          Start your week
        </div>
        <div
          style={{ fontSize: 12, color: 'var(--ink-low)', marginBottom: 14 }}
        >
          You haven&apos;t written a Weekly Commit yet.
        </div>
        <button
          type="button"
          data-testid="widget-cta"
          className="btn btn-primary btn-sm lift"
          onClick={() => onOpen('edit')}
        >
          <Icon.plus size={13} /> Start this week
        </button>
      </div>
    </section>
  );
}

/** The loading skeleton — matches the card/compact footprint so the host layout doesn't shift. */
function WidgetSkeleton({
  variant,
}: {
  variant: 'card' | 'compact';
}): JSX.Element {
  if (variant === 'compact') {
    return (
      <div
        data-testid="widget-compact"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)',
          padding: '11px 14px',
          boxShadow: 'var(--shadow-1)',
        }}
      >
        <Skeleton lines={1} />
      </div>
    );
  }
  return (
    <section
      data-testid="widget-card"
      aria-label="Weekly Commit widget"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-1)',
        overflow: 'hidden',
      }}
    >
      <div style={{ height: 3, background: 'var(--line)' }} />
      <div style={{ padding: '16px 18px' }}>
        <Skeleton lines={4} />
      </div>
    </section>
  );
}

/**
 * The widget body once providers exist: drives every state off the current-week query — LOADING
 * (skeleton), ERROR (retry), EMPTY (start your week), and the populated CARD / COMPACT variant. A host
 * may pass `week` to skip the fetch; otherwise it self-fetches via RTK Query.
 */
function WidgetBody({
  variant,
  onOpen,
  week,
}: {
  variant: 'card' | 'compact';
  onOpen: (route: WidgetRoute) => void;
  week?: CommitDto | null;
}): JSX.Element {
  const skip = week !== undefined;
  const { data, isLoading, isError, refetch } = useGetCurrentWeekQuery(
    undefined,
    { skip },
  );
  const commit = skip ? week : data;

  if (!skip && isLoading) {
    return <WidgetSkeleton variant={variant} />;
  }
  if (!skip && isError) {
    if (variant === 'compact') {
      return (
        <div
          data-testid="widget-compact"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            padding: '11px 14px',
            fontSize: 12,
            color: 'var(--red)',
            boxShadow: 'var(--shadow-1)',
          }}
        >
          Could not load this week.
        </div>
      );
    }
    return (
      <section
        data-testid="widget-card"
        aria-label="Weekly Commit widget"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)',
          boxShadow: 'var(--shadow-1)',
          padding: 16,
        }}
      >
        <ErrorState
          title="Could not load this week"
          onRetry={() => void refetch()}
        />
      </section>
    );
  }

  if (!commit || commit.items.length === 0) {
    return <WidgetEmpty variant={variant} onOpen={onOpen} />;
  }

  return variant === 'compact' ? (
    <CompactStrip commit={commit} onOpen={onOpen} />
  ) : (
    <WidgetCard commit={commit} onOpen={onOpen} />
  );
}

const defaultOpen: (route: WidgetRoute) => void = () => undefined;

/**
 * The federated Weekly Commit widget. Self-contained: it always mounts its OWN per-instance
 * Redux/Auth providers (a fresh store per widget mount, isolated from the host and from any other
 * widget on the page) so a host can drop it on a dashboard standalone — the body's RTK Query hook
 * always has a store even when a caller supplies `week` to skip the fetch. `onOpen(route)` asks the
 * host to navigate into the full module. Default export is stable (the MF expose
 * './WeeklyCommitWidget' and the host demo import it).
 */
export function WeeklyCommitWidget({
  onOpen = defaultOpen,
  variant = 'card',
  week,
}: WeeklyCommitWidgetProps): JSX.Element {
  // One isolated store for this widget's lifetime — never the app-shell singleton, so embedding the
  // widget can't collide with the host's own Redux (or another widget instance) and tests stay clean.
  const storeRef = useRef<AppStore>();
  if (!storeRef.current) storeRef.current = makeStore();
  return (
    <div data-testid="wcm-widget" data-variant={variant}>
      <AppProviders store={storeRef.current}>
        <WidgetBody variant={variant} onOpen={onOpen} week={week} />
      </AppProviders>
    </div>
  );
}

export default WeeklyCommitWidget;
