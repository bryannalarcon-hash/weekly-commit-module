// tailwind.config.js — Tailwind theme + content scanning for the WCM frontend (OKLCH + IBM Plex
// re-skin). Color utilities are mapped to the design's CSS custom properties (defined once in
// libs/ui/src/styles/global.css), so `bg-surface-1`, `text-ink`, `border-line`, `text-signal`, etc.
// resolve to the same OKLCH tokens that raw CSS uses — one source of truth (theme.colors.mjs drives
// global.css; this file references the resulting --vars). Radii map to --r-*, fonts to IBM Plex
// Sans/Mono/Serif (FONT_* stacks), and the elevation scale to --shadow-1/2/pop. Globs are anchored to
// this config's own directory so they resolve no matter the build cwd. Flowbite content/plugin stay
// wired for any not-yet-migrated component this run; the design itself uses Tailwind utilities only.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import flowbite from 'flowbite-react/tailwind';
import { FONT_SANS, FONT_MONO, FONT_SERIF, RADII } from './libs/ui/src/theme.colors.mjs';

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    join(root, 'apps/**/index.html'),
    join(root, 'apps/**/src/**/*.{js,ts,jsx,tsx}'),
    join(root, 'libs/**/src/**/*.{js,ts,jsx,tsx}'),
    flowbite.content(),
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces (zoned light theme): canvas → floating cards.
        void: 'var(--void)',
        base: 'var(--base)',
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        // Hairlines.
        line: {
          DEFAULT: 'var(--line)',
          soft: 'var(--line-soft)',
          bright: 'var(--line-bright)',
        },
        // Text — deep slate-navy ramp.
        ink: {
          DEFAULT: 'var(--ink)',
          mid: 'var(--ink-mid)',
          low: 'var(--ink-low)',
          faint: 'var(--ink-faint)',
        },
        // Brand & status — each with its light -dim tint (and signal also has -deep).
        signal: {
          DEFAULT: 'var(--signal)',
          dim: 'var(--signal-dim)',
          deep: 'var(--signal-deep)',
        },
        amber: { DEFAULT: 'var(--amber)', dim: 'var(--amber-dim)' },
        red: { DEFAULT: 'var(--red)', dim: 'var(--red-dim)' },
        cyan: { DEFAULT: 'var(--cyan)', dim: 'var(--cyan-dim)' },
        violet: { DEFAULT: 'var(--violet)', dim: 'var(--violet-dim)' },
        slate: { DEFAULT: 'var(--slate)', dim: 'var(--slate-dim)' },
      },
      fontFamily: {
        sans: FONT_SANS,
        mono: FONT_MONO,
        serif: FONT_SERIF,
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
      borderRadius: {
        xs: RADII.xs, // 4px
        sm: RADII.sm, // 7px
        md: RADII.md, // 11px
        lg: RADII.lg, // 16px
        pill: RADII.pill, // 999px
        DEFAULT: RADII.sm,
      },
      boxShadow: {
        1: 'var(--shadow-1)', // resting cards
        2: 'var(--shadow-2)', // hover / lift, modals
        pop: 'var(--shadow-pop)', // drawers / dialogs
      },
      transitionDuration: {
        // Subtle, functional motion (150–200ms).
        DEFAULT: '175ms',
      },
    },
  },
  plugins: [flowbite.plugin()],
};
