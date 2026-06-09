// libs/ui — shared presentational primitives barrel for the Weekly Commit Module (OKLCH + IBM Plex
// re-skin). Tailwind utility classes + the single global.css token layer ONLY (no Flowbite, no CSS
// modules/styled-components); components map the design in via CSS-var inline styles + the global
// .btn-*/.kicker/.tnum/.lift/.sk utility classes. Re-exports the design tokens, the inline icon set,
// and the re-skinned primitive set: lifecycle badge, chess badge + selector, RCDO chip + breadcrumb,
// the metric/toggle/pulse/avatar atoms, the skeleton/empty/error state primitives, the scrim + confirm
// dialog, and the autosave indicator; PLUS the composite parts (CommitItemRow read/edit row, WeekHeader,
// PastDueBanner, ValidationSummary, SectionTitle, ItemStatus, CarriedForwardCard), the RcdoPickerDrawer
// (right-drawer 4-level picker), and the WcShell internal sub-nav (supersedes WcNavigation). Importing
// from '@wcm/ui' is the supported entry. NOTE: co-located Vitest specs import the component file DIRECTLY
// (not through this barrel).

// ── Design tokens (OKLCH literals, CSS-var registry, lifecycle/chess/RCDO maps) ──
export * from './tokens';
// Namespace handle for callers that prefer `import { tokens } from '@wcm/ui'`.
export * as tokens from './tokens';

// ── Inline icon set (design 24x24 / 1.6-stroke glyphs + legacy named exports) ──
export * from './icons';
// Namespace handle for callers that prefer `import { icons } from '@wcm/ui'`.
export * as icons from './icons';

// ── Lifecycle / priority badges ──
export * from './LifecycleBadge'; // LifecycleBadge
export * from './ChessBadge'; // ChessBadge
export * from './ChessSelector'; // ChessSelector

// ── RCDO strategy linking ──
export * from './RcdoChip'; // RcdoChip (+ re-exports RcdoBreadcrumb, RcdoPath)
export * from './RcdoBreadcrumb'; // RcdoBreadcrumb, RcdoPath, crumbsOf

// ── Atoms ──
export * from './Avatar'; // Avatar
export * from './Metric'; // Metric
export * from './Toggle'; // Toggle
export * from './Pulse'; // Pulse
export * from './AutosaveIndicator'; // AutosaveIndicator

// ── Async-surface state primitives ──
export * from './StatePrimitives'; // Skeleton, EmptyState, ErrorState
export * from './Scrim'; // Scrim (modal/drawer shell)
export * from './ConfirmDialog'; // ConfirmDialog

// ── Composite parts ──
export * from './CommitItemRow'; // CommitItemRow (read + edit/composer modes)
export * from './WeekHeader'; // WeekHeader
export * from './PastDueBanner'; // PastDueBanner
export * from './ValidationSummary'; // ValidationSummary
export * from './SectionTitle'; // SectionTitle
export * from './ItemStatus'; // ItemStatus, ItemStatusKey
export * from './CarriedForwardCard'; // CarriedForwardCard

// ── RCDO picker drawer (the re-skinned right-drawer picker; emits RcdoSelection) ──
export * from './RcdoPickerDrawer'; // RcdoPickerDrawer, RcdoSelection

// ── Shell ──
// WcShell is the re-skin's INTERNAL sub-nav + content region (design shell.jsx) — it SUPERSEDES
// WcNavigation. WcNavigation is kept exported below for any caller still importing it directly, but new
// code should use WcShell; the app integration (wiring the c-design frontend) migrates the remaining
// WcNavigation consumers over to WcShell.
export * from './WcShell'; // WcShell, WcNavId, WcManagerSubId
export * from './WcNavigation'; // WcNavigation (DEPRECATED — superseded by WcShell)
