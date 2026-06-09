// libs/ui/src/theme.colors.d.mts — ambient types for the plain-JS OKLCH color-literal module so the
// typed tokens.ts (and tailwind.config.js) can share one source under allowJs:false + Bundler
// resolution. Mirrors the export shape of theme.colors.mjs exactly (surfaces, hairlines, ink, the
// status families with .base/.dim/.deep, radii, shadows, the flat SEMANTIC intents, hex companions,
// and the IBM Plex font stacks).
type BaseDim = { base: string; dim: string };
type BaseDimDeep = { base: string; dim: string; deep: string };

export const SURFACE: { void: string; base: string; s1: string; s2: string; s3: string };
export const LINE: { line: string; soft: string; bright: string };
export const INK: { ink: string; mid: string; low: string; faint: string };
export const SIGNAL: BaseDimDeep;
export const AMBER: BaseDim;
export const RED: BaseDim;
export const CYAN: BaseDim;
export const VIOLET: BaseDim;
export const SLATE: BaseDim;
export const RADII: { xs: string; sm: string; md: string; lg: string; pill: string };
export const SHADOW: { 1: string; 2: string; pop: string };
export const SEMANTIC: {
  success: string;
  warning: string;
  danger: string;
  info: string;
  draft: string;
};
export const HEX: {
  void: string;
  base: string;
  s1: string;
  s2: string;
  s3: string;
  line: string;
  lineSoft: string;
  lineBright: string;
  ink: string;
  inkMid: string;
  inkLow: string;
  inkFaint: string;
  signal: string;
  signalDim: string;
  signalDeep: string;
  amber: string;
  amberDim: string;
  red: string;
  redDim: string;
  cyan: string;
  cyanDim: string;
  violet: string;
  violetDim: string;
  slate: string;
  slateDim: string;
};
export const FONT_SANS: string[];
export const FONT_MONO: string[];
export const FONT_SERIF: string[];
