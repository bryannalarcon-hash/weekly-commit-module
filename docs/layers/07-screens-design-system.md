<!-- docs/layers/07-screens-design-system.md — faithful architecture doc for the WC remote screens
     (apps/wc-remote) mapped to the weekly lifecycle, plus the libs/ui OKLCH+IBM Plex design system. -->

# Layer 07 — Screens & Design System

## Executive summary

This layer is everything a viewer actually sees: the **screens** of the Weekly Commit remote
(`apps/wc-remote/src/screens`) and the **design system** that paints them (`libs/ui`). The screens are
thin, RTK-Query-driven views — each one drives its whole UI off a single query's load/empty/error/data
states and receives navigation as **callback props** (no router imports, no hardcoded routes). They map
1:1 onto the weekly commit lifecycle: write a draft (`EditCommit`), see the current week
(`MyWeeklyCommit`), lock it, reconcile planned-vs-actual (`Reconciliation`), browse history
(`CommitHistory` / `PastCommitDetail`), and — for managers — review reports (`ReviewQueue` /
`ReviewDetail`), roll up the team (`RollupDashboard`), and schedule a 1:1 (`ScheduleDialog`). A
self-contained federated `widget.tsx` tile re-uses the same data + tokens for a host dashboard.

The design system is **single-source OKLCH tokens**: `libs/ui/src/theme.colors.mjs` authors every color
once, and that single literal is mirrored three ways — into `global.css` `:root` CSS custom properties,
into `tailwind.config.js` color utilities, and into the typed runtime maps in `tokens.ts`
(`LIFECYCLE_VISUAL`, `CHESS_*`, `RCDO_LEVEL`). Components style themselves with **CSS-var inline styles
+ a small set of `.btn-*`/`.kicker`/`.tnum`/`.panel` utility classes + Tailwind utilities** — no CSS
modules, no styled-components. IBM Plex Sans/Mono/Serif is the type system. Accessibility is structural:
status is never conveyed by color alone (`LifecycleBadge` carries text + icon), dialogs trap focus
(`Scrim`), and reorder is keyboard-operable.

> **DRIFT (verify):** the libs/ui barrel and screens claim "no Flowbite," but `flowbite-react` is still a
> dependency, still wired into `tailwind.config.js`, and still imported by one component
> (`WeekSelector.tsx`). And the brief's "jest-axe tested" a11y claim is **not** literally true — no test
> invokes `axe()`. See [Gotchas & sharp edges](#gotchas--sharp-edges).

## Responsibilities

- **Render the weekly lifecycle as screens.** One screen per lifecycle stage / persona surface, each a
  self-contained view over an RTK Query hook (`apps/wc-remote/src/screens`).
- **Stay navigation-agnostic.** Screens take `onEdit` / `onReconcile` / `onOpenReview` / `onBack` etc. as
  props; the route table (Layer 1.5, not this doc) wires them. Example: `MyWeeklyCommitProps` is just
  `{ onEdit, onReconcile }` (`apps/wc-remote/src/screens/MyWeeklyCommit.tsx:38`).
- **Own the design system.** A single OKLCH palette and the typed lifecycle/chess/RCDO maps, mirrored to
  CSS vars + Tailwind utilities (`libs/ui/src/theme.colors.mjs`, `libs/ui/src/tokens.ts`,
  `libs/ui/src/styles/global.css`, `tailwind.config.js`).
- **Provide reusable primitives + composites.** Badges, chips, the metric/toggle/pulse atoms, the
  skeleton/empty/error states, the modal/drawer shells, and the internal sub-nav (`libs/ui/src/index.ts`).
- **Keep state non-color, keyboard-reachable, and CLS-safe.** Text+icon badges, focus-trapped dialogs,
  layout-reserving skeletons.

---

## Half 1 — Screens mapped to the weekly lifecycle

Every screen is a default/named React component whose only inputs are an id (when it scopes to one
commit) and navigation callbacks. Data + mutations flow exclusively through `@wcm/api` RTK Query hooks.

### Employee screens

| Screen | Lifecycle stage | Purpose | path:line |
| --- | --- | --- | --- |
| `MyWeeklyCommit` | Current week home (all states) | Landing view; switches on `lifecycleState` across DRAFT / LOCKED / RECONCILING / RECONCILED + EMPTY + LOADING/ERROR; Lock gated on all-linked | `apps/wc-remote/src/screens/MyWeeklyCommit.tsx:84` |
| `EditCommit` | DRAFT → authoring/lock | The composer: drag-reorder, title, chess tier, RCDO link, 400 ms debounced autosave, Submit & lock | `apps/wc-remote/src/screens/EditCommit.tsx:200` |
| `Reconciliation` | RECONCILING → RECONCILED | Planned-vs-actual two-column compare; per-item status (300 ms debounced PATCH); carry-forward + mark-reconciled | `apps/wc-remote/src/screens/Reconciliation.tsx:59` |
| `CommitHistory` | Archive (browse) | Past weeks newest-first, lifecycle filter chips, completion bar; opens `PastCommitDetail` | `apps/wc-remote/src/screens/CommitHistory.tsx:35` |
| `PastCommitDetail` | Archive (one week) | Read-only past week: summary + items with chess badge, RCDO breadcrumb, status pill | `apps/wc-remote/src/screens/PastCommitDetail.tsx:49` |
| `RcdoBrowser` | Strategy (cross-cutting) | Two-pane RCDO tree browser; admins (gated on `canReview`) edit via the level mutations | `apps/wc-remote/src/screens/RcdoBrowser.tsx:334` |
| `Settings` | Account / integrations | Account + Integrations tabs; Outlook delegated-consent redirect | `apps/wc-remote/src/screens/Settings.tsx:525` |

### Manager screens

| Screen | Lifecycle stage | Purpose | path:line |
| --- | --- | --- | --- |
| `ReviewQueue` | Manager review (week) | Direct reports for a week; week stepper + submission filter chips; opens locked submissions | `apps/wc-remote/src/screens/manager/ReviewQueue.tsx:86` |
| `ReviewDetail` | Manager review (one report) | Per-item review cards (comment/flag/reviewed), Schedule 1:1, Mark reviewed | `apps/wc-remote/src/screens/manager/ReviewDetail.tsx:59` |
| `RollupDashboard` | Manager roll-up | 4 metric tiles + sparkline + sortable paginated reports table with drill-through | `apps/wc-remote/src/screens/manager/RollupDashboard.tsx:37` |
| `ScheduleDialog` | Manager review (modal) | "Schedule 1:1" Outlook event modal opened from `ReviewDetail` | `apps/wc-remote/src/screens/manager/ScheduleDialog.tsx:60` |
| `WeeklyCommitWidget` | Host dashboard tile | Self-contained federated widget (own store, `onOpen` callback to host) | `apps/wc-remote/src/widget.tsx:692` |

### Screen-by-screen detail (verified behaviors)

**`MyWeeklyCommit`** drives everything off `useGetCurrentWeekQuery()`
(`MyWeeklyCommit.tsx:85`). It renders LOADING (skeleton panel + 3 card skeletons,
`:88`), ERROR (`ErrorState` + retry, `:105`), and EMPTY ("Start your week" → `useCreateCommitMutation`
then `onEdit(c.id)`, `:114`). Populated, `WeekSummaryView` switches by `commit.lifecycleState`
(`:155`): DRAFT shows "Continue editing" + a **Lock week** button `disabled={unlinked > 0}` (`:184`),
the autosave indicator and "`{total} items · {linkedCount}/{total} linked`" (`:222`), a `PastDueBanner`
when overdue, a `ValidationSummary` when items are unlinked, a carried-forward section, the read-mode
`CommitItemRow` list, and a read-only `Pulse`. The lock confirm routes to the composer (`onEdit`,
`:326`) — the actual lock mutation lives in `EditCommit`, not here.

**`EditCommit`** is the core authoring screen (`EditCommit.tsx:200`). It hydrates a local editing copy
from the server once (`:222`), and renders a `@dnd-kit` sortable list — `DndContext` + `SortableContext`
with a **keyboard-accessible** grip wired via `KeyboardSensor` + `sortableKeyboardCoordinates`
(`:238`, `:507`). Each row (`SortableComposerRow`, `:101`) has a title input, a `ChessSelector`, an
`RcdoChip` that opens `RcdoPickerDrawer`, and delete. Autosave is **debounced 400 ms** through
`useUpdateCommitMutation` (`scheduleSave`, `:267`), with `runSave` as the single PUT path (`:245`); a
`flushSave` cancels the timer and persists pending items immediately (`:282`). **Submit & lock**
(`useSubmitCommitMutation`) is `disabled={!canSubmit}` where `canSubmit = items.length > 0 && unlinked
=== 0 && blank === 0` (`:335`), and `doLock` **flushes the pending autosave first** so the lock never
freezes a stale plan and a late PUT cannot 409 against a LOCKED commit (`:380`). The RCDO tree is
flattened to an outcome-id→title map so a previously-linked item shows its real name on load (`:339`),
and a stable first-6 leaf slice seeds the picker's "Suggested for you" shortlist (`:356`).

**`Reconciliation`** (`Reconciliation.tsx:59`) reads `useGetReconciliationQuery` and splits rows into
**planned** (frozen plan) vs **added-after-lock** (`:101`). It renders a two-column PLANNED (locked-tint,
`ChessBadge`) vs ACTUAL grid that collapses to one column on mobile (`md:grid-cols-2`, `:280`), plus
three tinted `Metric` tiles (Completion %, Completed n/total, Carrying over, `:257`). Per-item status
edits are **debounced 300 ms**, keyed by `itemId`, with local-optimistic state so the control doesn't
snap back during the refetch (`queueStatusChange`, `:82`). Guards: a DRAFT commit shows a "not locked
yet" empty state (`:136`); RECONCILED shows a success banner with a post-reconcile **Carry forward**
action (`useCarryForwardMutation` + `useMarkReconciledMutation`, `:318`/`:344`). An INCOMPLETE actual row
shows "Will carry forward to next week" (`:429`).

**`CommitHistory`** (`CommitHistory.tsx:35`) lists `useGetMyWeeksQuery` newest-first as panel rows
(range, `LifecycleBadge`, done/total + carried metrics, completion % + mini bar + chevron). The filter
chips are **All / Reconciled / Reconciling** (`FILTERS`, `:17`); "Reconciled" includes the terminal
`CARRY_FORWARD` state (`matchesFilter`, `:24`). A row click → `onOpen(commitId)` opens
`PastCommitDetail`.

**`PastCommitDetail`** (`PastCommitDetail.tsx:49`) is read-only (no mutations): a summary panel
(completed count + recorded Pulse) and a "Commit items" list where each item carries a `ChessBadge`, the
`RcdoBreadcrumb` resolved from the RCDO tree by `supportingOutcomeId` (`pathById`, `:61`), and an
`ItemStatus` pill mapped from the final wire status (`statusKey`, `:28`).

**`RcdoBrowser`** (`RcdoBrowser.tsx:334`) is the Strategy screen: a Reddit-style threaded tree (rails
colored by ancestor level via `RCDO_LEVEL`, `TreeRow`, `:145`) with typeahead search on the left and a
detail panel on the right. An **Edit tree** toggle is shown only when `canAdmin` — gated **best-effort on
`account.canReview`** because no dedicated admin flag exists on the contract yet (`:336`, an explicit
ADMIN-GATE note in code). In edit mode it surfaces add/delete affordances and inline title editing that
call the level-specific admin mutations (`useCreate/Update/DeleteRallyCry…SupportingOutcome`, `:349`),
each of which invalidates the RCDO tree tag so `getRcdoTree` refetches. Deletes can 409 (a linked SO) —
the dialog just stays dismissed and the tree is the source of truth (`:454`).

**`Settings`** (`Settings.tsx:525`) is a two-tab shell (Account / Integrations). **Account** edits
display name + timezone (`useUpdateAccountMutation`), 5 notification toggles
(`useUpdateNotificationsMutation`), and a red Sign out (host owns Auth0 logout). **Integrations** is the
load-bearing piece: `Connect Outlook` → `useConnectOutlookMutation` returns an `authorizationUrl` →
`onRedirect(...)` navigates the browser to Microsoft Graph consent (`startConnect`, `:297`). States are
disconnected → connecting ("Redirecting to Microsoft…") → connected; the sync-preferences toggle is
disabled (`pointerEvents: none`, `opacity 0.55`) until connected (`:471`).

**`ReviewQueue`** (`ReviewQueue.tsx:86`) lists `useGetReviewQueueQuery({ weekStart })` for the manager's
direct reports. It collapses lifecycle/review/overdue truth into one **submission status** vocabulary
(`submissionOf`: reviewed → overdue → submitted → draft, `:35`), shown as a text+icon `SubmissionBadge`
(`:60`). A week **stepper** (newer/older + a native `<select>` carrying the `week-selector` testid,
`:138`) drives the query week. Filter chips (All / Needs review / Submitted / Draft / Overdue) with live
counts narrow client-side; only LOCKED rows are reviewable (`canReviewRow`, `:43`) and open
`onOpenReview(commitId, weekStart)`.

**`ReviewDetail`** (`ReviewDetail.tsx:59`) reads `useGetCommitQuery` + `useGetPulseQuery` and writes via
`useReviewCommitMutation`. Layout: a back/nav row, a report header (Avatar, name, week range,
`LifecycleBadge`, the member's Pulse), an amber notice when any item is unlinked (`:258`), and per-item
review cards with Comment / Flag / Mark-reviewed actions (local manager scratch state — flags and
per-item reviewed are not yet persisted per-item, `:71`). **Schedule 1:1** opens `ScheduleDialog`
(`:385`) and shows a "Scheduled ✓" note on success; **Mark reviewed** opens a `ConfirmDialog` before
posting `REVIEWED` (`:397`). A DRAFT commit renders "Nothing to review yet" (`:140`).

**`RollupDashboard`** (`RollupDashboard.tsx:37`) reads `useGetRollupQuery({ page, size })`. Four tiles:
weekly completion, carry-over rate, RCDO alignment (`Metric` tiles), and an **Unreviewed** tile carrying
an "Open queue" affordance (`:175`). A 6-cell completion-trend `Sparkline` (`:416`) is derived from the
real rows — not invented history (`:74`). The primary surface is a **sortable** reports table
(`SortHeader` drives client-side sort of the visible page, `:470`) with inline completion bars and status
dots; clicking a row (or the chevron) **drills through** via `useLazyGetReportLatestCommitQuery` to prime
the cache then `onDrillThrough(memberId)` (`drill`, `:85`). Footer **pagination** is server-backed
(`page-prev`/`page-next` against `data.totalPages`, `:388`).

**`ScheduleDialog`** (`ScheduleDialog.tsx:60`) is a centered `Scrim` modal in the `ConfirmDialog` visual
pattern, prefilled "1:1 — `<report>`", tomorrow 10:00, 30 min. It posts via
`useScheduleOutlookEventMutation` with `startDateTime` as an **ISO string carrying the local UTC offset**
(`toIsoWithOffset` computes the offset at that wall-clock time so DST resolves correctly, `:38`), and
maps a `409 illegal_state` ProblemDetail to an inline "Connect Outlook in Settings → Integrations first"
error (`scheduleErrorMessage`, `:49`).

**`WeeklyCommitWidget`** (`widget.tsx:692`) is the federated dashboard tile exposed as
`./WeeklyCommitWidget`. It **owns its own RTK store** — `makeStore()` per mount wrapped in
`AppProviders` (`:699`) — so a host can drop it standalone, and calls back via `onOpen(route)` to ask the
host to navigate into the full module. Two variants: a `card` (lifecycle top-stripe, progress ring,
top-3 items, contextual CTA via `ctaFor`, `:147`) and a slim `compact` strip. Lifecycle color/icon/label
come from `LIFECYCLE_VISUAL`; chess glyphs from `CHESS_GLYPH` — both from `@wcm/ui`, so the scheme stays
swappable.

---

## Half 2 — Design system (`libs/ui`)

### Single-source OKLCH token flow

The palette is authored **once** in `libs/ui/src/theme.colors.mjs` as plain JS (Tailwind cannot import
the `.ts` tokens module, so the literals must be plain JS — `theme.colors.mjs:8`). That single source
flows three ways:

```
theme.colors.mjs  (OKLCH literals: SURFACE/LINE/INK/SIGNAL/AMBER/RED/CYAN/VIOLET/SLATE, RADII, SHADOW, FONT_*)
        │
        ├─► global.css  :root { --void, --signal, --lc-*, … }   (libs/ui/src/styles/global.css:13)
        │       resolved CSS custom properties + .btn-*/.kicker/.tnum/.panel/.wc-* utility classes
        │
        ├─► tailwind.config.js  colors map → var(--…)            (tailwind.config.js:26)
        │       bg-surface-1 / text-ink / border-line / text-signal resolve to the SAME vars
        │
        └─► tokens.ts  typed re-export + runtime maps            (libs/ui/src/tokens.ts:29)
                LIFECYCLE_VISUAL, CHESS_*, RCDO_LEVEL, CSS_VARS, cssVar()
```

Components reference the CSS-var **strings** (e.g. `color: 'var(--signal)'`) so `global.css` owns the
resolved values; the `*.hex` companions in `theme.colors.mjs:95` exist only for non-CSS surfaces (charts,
the `LIFECYCLE_VISUAL.hex` swatch). A brand swap is one edit in `theme.colors.mjs`.

### Styling discipline (no CSS modules / styled-components)

The barrel header states the rule explicitly: "Tailwind utility classes + the single global.css token
layer ONLY (no Flowbite, no CSS modules/styled-components)" (`libs/ui/src/index.ts:1`). Components map
the design in via **CSS-var inline styles** + the global utility classes — `.btn-(primary|ghost|quiet|
danger)`, `.input`, `.kicker`, `.tnum`, `.mono`, `.panel`, `.between`, `.lift`, `.sk`, and the WC shell
classes `.wc`/`.wc-subnav`/`.wc-tab`/`.wc-content`/`.page` (`global.css:267`–`:481`). Type is IBM Plex
Sans/Mono/Serif, loaded via a Google Fonts `@import` in `global.css:11` and exposed as
`--sans`/`--mono`/`--serif` plus the `FONT_*` stacks for Tailwind.

### Lifecycle states → visual treatment (`LIFECYCLE_VISUAL`)

There are **5** lifecycle states; each gets one consistent badge = CSS-var color + light `-dim` fill +
icon + label (`tokens.ts:137`). The lifecycle CSS-var aliases are defined in `global.css:49`.

| State | Color (alias → family) | Dim fill | Icon | Label |
| --- | --- | --- | --- | --- |
| `DRAFT` | `--lc-draft` → slate | `--lc-draft-dim` | `pencil` | Draft |
| `LOCKED` | `--lc-locked` → cyan | `--lc-locked-dim` | `lock` | Locked |
| `RECONCILING` | `--lc-reconciling` → amber | `--lc-reconciling-dim` | `reconcile` | Reconciling |
| `RECONCILED` | `--lc-reconciled` → signal-green | `--lc-reconciled-dim` | `checkCircle` | Reconciled |
| `CARRY_FORWARD` | `--lc-carry` → violet | `--lc-carry-dim` | `forward` | Carried forward |

(Source: `tokens.ts:137`–`:173`; aliases `global.css:49`–`:59`.)

### Chess tiers → glyphs (`CHESS_ORDER` / `CHESS_GLYPH`)

There are **6** chess tiers, ordered KING (heaviest) → PAWN (`CHESS_ORDER`, `tokens.ts:176`). Emphasis is
restrained to line/tone, **not hue** (it's a finance tool) — `CHESS_COLOR` only ever swaps between
`--line-bright` (KING/QUEEN) and `--line-soft` (`tokens.ts:220`).

| Tier | Glyph | Weight | Label | Priority hint |
| --- | --- | --- | --- | --- |
| KING | ♚ | 6 | King | Top strategic weight |
| QUEEN | ♛ | 5 | Queen | High priority |
| ROOK | ♜ | 4 | Rook | Standard priority |
| BISHOP | ♝ | 3 | Bishop | Moderate priority |
| KNIGHT | ♞ | 2 | Knight | Lower priority |
| PAWN | ♟ | 1 | Pawn | Supporting / small |

(Source: `CHESS_GLYPH` `tokens.ts:199`, `CHESS_WEIGHT` `:189`, `CHESS_LABEL` `:179`, `CHESS_HINT` `:209`.)

### RCDO levels (`RCDO_LEVEL`)

Four strategy-tree levels, leaf-linkable at the bottom: Rally Cry (violet), Defining Objective (cyan),
Outcome (amber), Supporting Outcome (signal-green — the linkable leaf) (`tokens.ts:243`). Used to color
the tree rails in `RcdoBrowser` and the level pills in `RcdoPickerDrawer`.

### ItemStatus keys (per-item status pills)

`ItemStatus` maps a presentational key to color + dim + icon (text+icon, never color-only): `completed`
(signal/checkCircle), `incomplete` (red/x), `carried` (violet/carry), `added` (amber/plus), `pending`
("In progress", ink-low/clock) (`libs/ui/src/ItemStatus.tsx:27`). Screens translate wire statuses to
these keys (e.g. `MyWeeklyCommit.tsx:70`, `Reconciliation.tsx:38`).

### Component inventory

| Component | Role | path:line |
| --- | --- | --- |
| `theme.colors.mjs` | OKLCH single-source palette + radii/shadows/fonts | `libs/ui/src/theme.colors.mjs:11` |
| `tokens.ts` | Typed re-export + `LIFECYCLE_VISUAL` / `CHESS_*` / `RCDO_LEVEL` / `CSS_VARS` | `libs/ui/src/tokens.ts:29` |
| `global.css` | `:root` CSS vars + motion keyframes + `.btn-*`/`.wc-*`/`.panel` utilities | `libs/ui/src/styles/global.css:13` |
| `index.ts` | The `@wcm/ui` barrel (supported import surface) | `libs/ui/src/index.ts:14` |
| `icons.tsx` | Inline 24×24 stroke icon set (`Icon.*` + legacy named) | `libs/ui/src/icons.tsx:53` |
| `LifecycleBadge` | The one lifecycle pill (text + icon, non-color-only) | `libs/ui/src/LifecycleBadge.tsx:18` |
| `ChessBadge` | Read-only priority chip (weight = line/tone/glyph-opacity) | `libs/ui/src/ChessBadge.tsx:16` |
| `ChessSelector` | Segmented radiogroup tier picker (role=radio + aria-checked) | `libs/ui/src/ChessSelector.tsx:18` |
| `RcdoChip` | Linked green pill / amber-dashed "Link a Supporting Outcome" affordance | `libs/ui/src/RcdoChip.tsx:30` |
| `RcdoBreadcrumb` | Faint mono RCDO ladder (leaf in signal-green) | `libs/ui/src/RcdoBreadcrumb.tsx:32` |
| `RcdoPickerDrawer` | Right-drawer 4-level picker (search + keyboard drill-in) | `libs/ui/src/RcdoPickerDrawer.tsx:128` |
| `CommitItemRow` | Read + edit/composer commit-item row | `libs/ui/src/CommitItemRow.tsx:59` |
| `WcShell` | Internal sub-nav + content region (replaced `WcNavigation`) | `libs/ui/src/WcShell.tsx:59` |
| `StatePrimitives` | `Skeleton` / `EmptyState` / `ErrorState` | `libs/ui/src/StatePrimitives.tsx:20` |
| `Scrim` | Focus-trapping modal/drawer backdrop (Esc + click-out) | `libs/ui/src/Scrim.tsx` |
| `ConfirmDialog` | Centered confirm modal (busy state, destructive variant) | `libs/ui/src/ConfirmDialog.tsx:28` |
| `Metric` | Tinted dashboard metric tile (value + suffix + optional delta) | `libs/ui/src/Metric.tsx:26` |
| `Pulse` | 1–5 weekly pulse + note + manager-only toggle | `libs/ui/src/Pulse.tsx:27` |
| `Toggle` | role=switch on/off (signal track) | `libs/ui/src/Toggle.tsx:15` |
| `Avatar` | Deterministic-hue initials avatar | `libs/ui/src/Avatar.tsx:36` |
| `ItemStatus` | Per-item status pill (5 keys) | `libs/ui/src/ItemStatus.tsx:27` |

(Other composites in the barrel: `WeekHeader`, `PastDueBanner`, `ValidationSummary`, `SectionTitle`,
`CarriedForwardCard`, `AutosaveIndicator` — `index.ts:32`–`:51`.)

---

## Interfaces & contracts

- **Screen props are id + callbacks.** Examples: `MyWeeklyCommitProps { onEdit, onReconcile }`
  (`MyWeeklyCommit.tsx:38`); `EditCommitProps { commitId, onBack?, onLocked? }` (`EditCommit.tsx:77`);
  `ReconciliationProps { commitId, onBackToWeek }` (`Reconciliation.tsx:53`); `ReviewQueueProps {
  onOpenReview }` (`ReviewQueue.tsx:19`); `ReviewDetailProps { commitId, memberName?, onBack,
  onReconcile?, onPrev?, onNext? }` (`ReviewDetail.tsx:30`); `RollupDashboardProps { onDrillThrough?,
  onOpenQueue? }` (`RollupDashboard.tsx:18`); `SettingsProps { onRedirect?, onSignOut? }`
  (`Settings.tsx:39`). None import a router.
- **Widget contract.** `WeeklyCommitWidgetProps { onOpen?, variant?, week? }` (`widget.tsx:30`);
  `WidgetRoute = 'myweek' | 'edit'` (`:27`). When `week` is omitted it self-fetches; otherwise the host's
  pre-fetched commit is used (the body's hook still has a store because the widget always mounts its own).
- **Design-system surface.** `@wcm/ui` re-exports the tokens (`LIFECYCLE_VISUAL`, `CHESS_GLYPH`,
  `RCDO_LEVEL`, `CSS_VARS`, `cssVar`), the icon set, and every primitive (`index.ts:14`). The CSS-var
  registry `CSS_VARS` is a const map so a typo is a compile error, not a silent no-op (`tokens.ts:64`).
- **Picker contract.** `RcdoPickerDrawer` emits `RcdoSelection { outcome: SupportingOutcomeDto, path:
  RcdoPath }` on leaf-select and `onClear()` to unlink (`RcdoPickerDrawer.tsx:23`). Leaves carry
  `aria-level={4}` so the lifecycle E2E selector still resolves the first selectable leaf (`:452`).

## Data & state

- **Data is RTK Query only.** No `fetch`/`axios` in any screen; each reads/writes through `@wcm/api`
  hooks. (Per `docs/TECHNICAL.md` §1.5, `libs/api/src/commitApi.ts` is the only path to the backend.)
- **Local UI state is per-screen.** `EditCommit` keeps a hydrated editing copy + debounce refs
  (`saveTimer`, `pendingItems`, `EditCommit.tsx:210`–`:219`); `Reconciliation` keeps `localStatus` +
  keyed `statusTimers` (`Reconciliation.tsx:68`–`:73`); `ReviewDetail` keeps comment/flag/reviewed
  scratch Sets (`ReviewDetail.tsx:71`); `RollupDashboard` keeps `{ page, sort }` (`RollupDashboard.tsx:38`).
- **Tokens are stateless runtime maps.** `LIFECYCLE_VISUAL` / `CHESS_*` / `RCDO_LEVEL` are plain const
  objects; the only "state" is the CSS cascade resolving the vars at render.

## Dependencies

**Depends on**

- `@wcm/api` — every RTK Query hook (queries + mutations) the screens use.
- `@wcm/types` — `CommitDto`, `CommitItemDto`, `LifecycleState`, `ChessTier`, `ReconciliationRow`,
  `ReviewQueueRow`, `RollupRow`, `SupportingOutcomeDto`, etc.
- `@wcm/ui` (`libs/ui`) — primitives + tokens + icons (the design system this doc's Half 2 covers).
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` — drag-reorder in `EditCommit`
  (`EditCommit.tsx:19`).
- `apps/wc-remote/src/lib/week.ts` — pure date/progress formatters (`formatWeekRange`, `isPastDue`,
  `completedCount`, `formatProgress`, `parseIsoDate`), framework-free so screens + tests share one source
  (`lib/week.ts:1`).
- `flowbite-react` — **still** imported by `WeekSelector.tsx:5` and wired in `tailwind.config.js`
  (see DRIFT).

**Used by**

- `apps/wc-remote/src/app/routes.tsx` (the lazy route table, Layer 1.5) — mounts the screens and supplies
  their navigation callbacks; `WcShell` provides the sub-nav chrome around them.
- Host shell / host dashboard — consumes `WeeklyCommitWidget` (federated `./WeeklyCommitWidget`) and the
  full `./WeeklyCommitApp`.

## How it works (flow)

1. **Route → screen.** The route table renders one screen, passing `commitId` (when scoped) + navigation
   callbacks. The screen calls its RTK Query hook and renders LOADING → ERROR → EMPTY → DATA.
2. **Author (DRAFT).** `MyWeeklyCommit` (EMPTY) creates a commit and routes to `EditCommit`; the composer
   debounces autosave (400 ms) and, on **Submit & lock**, flushes the pending save then submits — guarded
   by all-linked + non-empty + ≥1 item.
3. **Reconcile.** Once LOCKED, the user opens `Reconciliation`, sets per-item actual statuses (300 ms
   debounced PATCH), then carry-forward + mark-reconciled.
4. **Archive.** `CommitHistory` lists past weeks; a row opens read-only `PastCommitDetail`.
5. **Manager loop.** `ReviewQueue` (by week) → `ReviewDetail` (per report; Schedule 1:1 → `ScheduleDialog`,
   Mark reviewed); `RollupDashboard` aggregates and drills back into review.
6. **Paint.** Every screen styles itself with CSS-var inline styles + global utility classes; status reads
   come from `LIFECYCLE_VISUAL` / `ItemStatus` / `CHESS_*` so a token swap re-themes the whole module.

## Design decisions & rationale

- **Callback-prop navigation, not router imports.** Keeps screens portable across the standalone remote
  and the federated host, and trivially testable. (Confirmed: no `react-router` import in any screen.)
- **Single-source OKLCH tokens mirrored 3 ways.** One palette edit re-themes CSS, Tailwind, and runtime
  maps in lockstep — no drift between a Tailwind color and a hardcoded inline value
  (`theme.colors.mjs:1`).
- **Status is text + icon, never color-only.** `LifecycleBadge`, `ItemStatus`, `RcdoChip` (amber-dashed
  "Link a Supporting Outcome"), and `SubmissionBadge` all pair a label with an icon — the a11y rule from
  the brief.
- **Restrained chess emphasis.** Priority weight is line brightness / glyph opacity, not a loud hue, so
  the institutional-fintech look holds (`ChessBadge.tsx:23`, `CHESS_COLOR` `tokens.ts:220`).
- **Debounce + flush, not optimistic-everything.** Autosave debounces but a lock flushes first
  (`EditCommit.tsx:380`); reconciliation status debounces with local-optimistic display to kill the
  fast-toggle flicker (`Reconciliation.tsx:82`).
- **Widget owns an isolated store.** A fresh `makeStore()` per widget mount prevents Redux collisions with
  the host or sibling widgets (`widget.tsx:699`).
- **Honest derivations.** The rollup sparkline + done-counts are computed from real rows, with code
  comments forbidding invented week-history fields (`RollupDashboard.tsx:74`).

## Gotchas & sharp edges

- **DRIFT — Flowbite is not actually gone.** The barrel/screens say "no Flowbite," but: `flowbite-react`
  is a dependency (`apps/wc-remote/package.json:21`), `tailwind.config.js` still calls
  `flowbite.content()` + `flowbite.plugin()` (`tailwind.config.js:11`,`:22`,`:85`), and
  `WeekSelector.tsx:5` still imports `{ Label, Select }` from it. The manager screens **bypass** that
  component — `ReviewQueue` imports only the pure `recentWeeks` helper and renders a **native** `<select>`
  (`ReviewQueue.tsx:16`,`:153`). So Flowbite is **wired-but-largely-unused**, not removed.
  `tailwind.config.js:8` admits this: "Flowbite content/plugin stay wired for any not-yet-migrated
  component this run." Describe it as *being phased out*, not deprecated-and-removed.
- **DRIFT — "jest-axe tested" is not literal.** A `jest-axe` type shim exists
  (`apps/wc-remote/src/test/jest-axe.d.ts`) but **no test invokes `axe()`** anywhere in `apps`/`libs`
  (verified by grep). `LifecycleBadge.test.tsx` proves the non-color-only invariant by **RTL assertions**
  (text content + an `<svg>` present + `data-state`), not an automated axe pass. The a11y guarantees are
  real and tested — just not via jest-axe.
- **`MyWeeklyCommit` does not lock; it delegates.** Its Lock confirm routes to `EditCommit`, which owns
  the real submit mutation + autosave flush (`MyWeeklyCommit.tsx:326`, comment at `:8`). Don't look for a
  lock mutation in `MyWeeklyCommit`.
- **Admin gate is best-effort.** `RcdoBrowser`'s Edit-tree affordance is gated on `account.canReview`
  (the manager flag) because no `canAdmin`/role exists on the contract yet — a UX gate only; real authz is
  server-side (`RcdoBrowser.tsx:336`).
- **Two `composer-item` rows exist.** `EditCommit` composes its own `SortableComposerRow` (so the dnd-kit
  ref lands on the measured `<li>`) rather than using the shared `CommitItemRow` edit mode — both keep the
  same testids, so they're interchangeable to tests but are two code paths (`EditCommit.tsx:85`).
- **Co-located specs import components directly.** Vitest specs import the component file, **not** the
  `@wcm/ui` barrel (`index.ts:11`) — moving a file requires updating its sibling spec import.
- **`ScheduleDialog` time is offset-aware.** It sends ISO-with-offset, not bare local time; a naive
  `toISOString()` would shift the event by the UTC offset (`ScheduleDialog.tsx:38`).

## Connects to

- **Layer 1.5 — Frontend (routing / MF / data).** `docs/TECHNICAL.md` §1.5: the lazy route table that
  mounts these screens, the MF remote exposure, and `commitApi.ts` (the RTK Query slice every screen
  reads).
- **API / contract layer.** The `@wcm/api` hooks and `@wcm/types` DTOs these screens consume
  (`docs/openapi.yaml`).
- **RCDO model layer.** The 4-level strategy tree the picker/browser/breadcrumb render
  (`docs/research/rcdo-model.md`).
- **Outlook / Graph integration.** The delegated-consent + calendar-event flow `Settings` and
  `ScheduleDialog` drive (`docs/setup/EXTERNAL_SERVICES_SETUP.md`).
