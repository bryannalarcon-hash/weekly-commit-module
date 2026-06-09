// tailwind.config.js — Tailwind CSS theme + content scanning for the WCM frontend (design brief §3).
// Scans apps/* and libs/* sources plus Flowbite React so its component classes are emitted, and pulls
// the navy/slate + accent + slate-neutral palette, Inter stack, and tabular-nums from the shared
// theme.colors.mjs literals (the single source also read by libs/ui/src/tokens.ts).
// Globs are anchored to this config's own directory so they resolve no matter the build cwd.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import flowbite from 'flowbite-react/tailwind';
import {
  PRIMARY,
  ACCENT,
  NEUTRAL,
  SEMANTIC,
  FONT_SANS,
} from './libs/ui/src/theme.colors.mjs';

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
        primary: PRIMARY,
        accent: ACCENT,
        // Override Tailwind's default `slate` so the institutional neutral is consistent.
        slate: NEUTRAL,
        success: SEMANTIC.success,
        warning: SEMANTIC.warning,
        danger: SEMANTIC.danger,
        info: SEMANTIC.info,
        draft: SEMANTIC.draft,
      },
      fontFamily: {
        sans: FONT_SANS,
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
      borderRadius: {
        // Small, institutional radii (design brief §3 — 4–8px).
        DEFAULT: '0.375rem',
      },
      transitionDuration: {
        // Subtle, functional motion (150–200ms) per design brief §3.
        DEFAULT: '175ms',
      },
    },
  },
  plugins: [flowbite.plugin()],
};
