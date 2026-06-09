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
          // The remote's remoteEntry.js URL. Defaults to localhost:4201 for normal dev; the E2E
          // harness sets VITE_REMOTE_ENTRY to host.docker.internal:4201 so the Dockerized browser
          // (which can't reach the host's localhost) loads the remote via the host gateway.
          entry: process.env.VITE_REMOTE_ENTRY ?? 'http://localhost:4201/remoteEntry.js',
        },
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.3.1' },
        'react-dom': { singleton: true, requiredVersion: '^18.3.1' },
        // react-router-dom MUST be a singleton: the host provides the BrowserRouter context and the
        // remote consumes useNavigate/useLocation from it — two copies would break the router context.
        'react-router-dom': { singleton: true, requiredVersion: '^6.26.1' },
      },
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,
  },
  server: {
    port: 4200,
    // allowedHosts: true so a Dockerized browser reaching the host via host.docker.internal isn't
    // blocked by Vite's host check (the E2E harness). Same-origin /api → backend (8080) so the
    // remote's RTK Query (baseUrl /api) reaches the API without CORS; WCM_API_TARGET overrides it.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.WCM_API_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4200,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.WCM_API_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
