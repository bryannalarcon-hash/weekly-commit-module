// tailwind.config.js — Tailwind CSS theme + content scanning for the WCM frontend.
// Scans apps/* and libs/* sources plus Flowbite React so its component classes are emitted.
// Globs are anchored to this config's own directory so they resolve no matter the build cwd.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import flowbite from 'flowbite-react/tailwind';

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
    extend: {},
  },
  plugins: [flowbite.plugin()],
};
