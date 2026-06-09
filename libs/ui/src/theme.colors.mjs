// libs/ui/src/theme.colors.mjs — framework-agnostic OKLCH design-token literals, the SINGLE source
// shared by tailwind.config.js (build time → CSS-var-backed Tailwind colors) AND tokens.ts (runtime,
// typed re-export) AND global.css (which mirrors these exact OKLCH strings into :root properties).
// This is the WCM institutional-fintech palette (ST6/Solovis direction): muted slate canvas, IBM
// Plex type, a value-creation green primary, and status tints (amber/red/cyan/violet/slate). Every
// color is authored in OKLCH (source of truth); the ~hex companions in HEX exist only for non-CSS
// surfaces (charts, the LIFECYCLE_VISUAL.hex swatch). A brand swap is one edit here; Tailwind cannot
// import the .ts tokens module, so the literals must live in plain JS.

/* ── Surfaces — light "zoned" theme: muted canvas, brighter floating cards ── */
export const SURFACE = {
  void: 'oklch(0.912 0.017 250)', // app canvas / page background
  base: 'oklch(0.963 0.012 250)', // sub-nav rail, inputs
  s1: 'oklch(0.996 0.002 250)', // cards/panels (float above canvas)
  s2: 'oklch(0.948 0.012 250)', // insets, hover, table header, kanban cols
  s3: 'oklch(0.912 0.016 250)', // progress tracks, chip fills
};

/* ── Hairlines (soft — separation is mostly tone + shadow) ── */
export const LINE = {
  line: 'oklch(0.882 0.013 250)',
  soft: 'oklch(0.912 0.012 250)',
  bright: 'oklch(0.818 0.018 250)',
};

/* ── Text — deep slate-navy ── */
export const INK = {
  ink: 'oklch(0.258 0.032 260)', // headings, primary
  mid: 'oklch(0.430 0.030 260)', // body
  low: 'oklch(0.548 0.026 260)', // labels, meta
  faint: 'oklch(0.655 0.020 260)', // disabled, IDs, hints
};

/* ── Brand & status — each has a light `-dim` tint for fills ── */
/** Primary value-creation green — reconciled/on-track, primary buttons, links. */
export const SIGNAL = {
  base: 'oklch(0.548 0.132 165)',
  dim: 'oklch(0.928 0.062 165)',
  deep: 'oklch(0.440 0.115 165)',
};
/** Reconciling, in-progress, warnings, unlinked. */
export const AMBER = {
  base: 'oklch(0.640 0.140 68)',
  dim: 'oklch(0.918 0.072 72)',
};
/** Blocked, overdue, destructive, incomplete. */
export const RED = {
  base: 'oklch(0.560 0.185 25)',
  dim: 'oklch(0.912 0.072 28)',
};
/** Locked, review, Defining Objective. */
export const CYAN = {
  base: 'oklch(0.535 0.128 244)',
  dim: 'oklch(0.918 0.058 244)',
};
/** Carry-forward, planning, Rally Cry, manager accent. */
export const VIOLET = {
  base: 'oklch(0.530 0.152 296)',
  dim: 'oklch(0.918 0.070 298)',
};
/** Draft / neutral. */
export const SLATE = {
  base: 'oklch(0.548 0.026 260)',
  dim: 'oklch(0.928 0.012 260)',
};

/* ── Radii ── */
export const RADII = {
  xs: '4px',
  sm: '7px',
  md: '11px',
  lg: '16px',
  pill: '999px',
};

/* ── Shadows (carry separation, not borders) ── */
export const SHADOW = {
  1: '0 1px 2px oklch(0.30 0.05 260 / 0.06), 0 3px 8px -2px oklch(0.30 0.05 260 / 0.10)',
  2: '0 16px 36px -16px oklch(0.28 0.06 260 / 0.28)',
  pop: '0 24px 60px -22px oklch(0.24 0.06 260 / 0.42)',
};

/* ── Semantic / lifecycle intents (status base colors as OKLCH) — kept as a flat map for callers
   that select by intent name rather than by status family. ── */
export const SEMANTIC = {
  success: SIGNAL.base,
  warning: AMBER.base,
  danger: RED.base,
  info: CYAN.base,
  draft: SLATE.base,
};

/* ── Approximate hex companions (NON-CSS surfaces only — charts / swatch fields).
   CSS surfaces always use the OKLCH vars above; these are convenience fallbacks. ── */
export const HEX = {
  void: '#dbe0e9',
  base: '#eef1f6',
  s1: '#fdfdff',
  s2: '#eaedf3',
  s3: '#dbe0e9',
  line: '#d2d7e0',
  lineSoft: '#dde1e9',
  lineBright: '#bcc3d0',
  ink: '#1f2636',
  inkMid: '#48505f',
  inkLow: '#69707d',
  inkFaint: '#878d98',
  signal: '#1a8a63',
  signalDim: '#d3f1e2',
  signalDeep: '#13704f',
  amber: '#a9750f',
  amberDim: '#f0e4c8',
  red: '#c0392b',
  redDim: '#f6dcd6',
  cyan: '#2d6fb0',
  cyanDim: '#d6e4f2',
  violet: '#7a45b8',
  violetDim: '#e8dcf4',
  slate: '#69707d',
  slateDim: '#e8eaef',
};

/* ── Type stacks (IBM Plex Sans/Mono/Serif; the webfonts are loaded via global.css @import) ── */
export const FONT_SANS = [
  'IBM Plex Sans',
  'system-ui',
  '-apple-system',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'sans-serif',
];
export const FONT_MONO = ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'];
export const FONT_SERIF = ['IBM Plex Serif', 'Georgia', 'Cambria', 'serif'];
