// apps/host-shell/vite.config.ts — Vite 5 config for the dev host that consumes the WC remote.
// Declares the wc remote's remoteEntry.js and shares react/react-dom as singletons. Live
// host->remote rendering is a later dedicated unit (U4); this wires the consumer contract now.
// CSS is pinned to the repo-root postcss.config.js so Tailwind scanning is cwd-independent.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

const rootPostcss = fileURLToPath(
  new URL('../../postcss.config.js', import.meta.url),
);

export default defineConfig({
  css: {
    postcss: rootPostcss,
  },
  plugins: [
    react(),
    federation({
      name: 'host',
      remotes: {
        wc: {
          type: 'module',
          name: 'wc',
          entry: 'http://localhost:4201/remoteEntry.js',
        },
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.3.1' },
        'react-dom': { singleton: true, requiredVersion: '^18.3.1' },
      },
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,
  },
  server: {
    port: 4200,
  },
  preview: {
    port: 4200,
  },
});
