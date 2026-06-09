// libs/ui/src/theme.colors.mjs — framework-agnostic color literals shared by tailwind.config.js
// (build time) AND tokens.ts (runtime, typed re-export). Keeping the hexes in one plain-JS module
// means a brand swap is a single edit; tailwind cannot import the .ts tokens module directly.

/** Navy/slate primary scale (design brief §3). */
export const PRIMARY = {
  50: '#eff5fb',
  100: '#d6e4f0',
  200: '#aec9e1',
  300: '#7ba6cd',
  400: '#4a80b3',
  500: '#2b6097',
  600: '#1d4a78',
  700: '#163a60',
  800: '#0f2c49',
  900: '#0b2a4a',
};

/** Professional-blue accent scale. */
export const ACCENT = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#2563eb',
  600: '#1d4ed8',
  700: '#1e40af',
  800: '#1e3a8a',
  900: '#172554',
};

/** Cool slate neutral scale. */
export const NEUTRAL = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
};

/** Semantic / lifecycle colors. */
export const SEMANTIC = {
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#0284c7',
  draft: '#64748b',
};

/** Inter-first UI font stack. */
export const FONT_SANS = [
  'Inter',
  'ui-sans-serif',
  'system-ui',
  '-apple-system',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'sans-serif',
];
