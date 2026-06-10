// apps/wc-remote/vite.config.ts — Vite 5 config for the Weekly Commit MF remote.
// Wires @vitejs/plugin-react + @module-federation/vite (exposes ./WeeklyCommitApp +
// ./WeeklyCommitWidget — the self-contained dashboard tile a host embeds — with
// react/react-dom as shared singletons) and a jsdom Vitest project for the render test.
// CSS pipeline is pinned to the repo-root postcss.config.js so Tailwind content scanning
// resolves correctly even when the build runs from this app subdirectory.
/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import {
  defineConfig,
  type Plugin,
  type PreviewServer,
  type ViteDevServer,
} from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

const rootPostcss = fileURLToPath(
  new URL('../../postcss.config.js', import.meta.url),
);

/**
 * CORS for the federated remoteEntry.js: the host (origin :4200) cross-origin module-imports the
 * remote's remoteEntry from :4201. A cross-origin module script import requires the remote to send
 * Access-Control-Allow-Origin, on both `vite` (dev serve) and `vite preview` (the E2E harness).
 */
function corsForRemoteEntry(): Plugin {
  const addCors = (server: ViteDevServer | PreviewServer): void => {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      next();
    });
  };
  return {
    name: 'wc-remote-cors',
    configureServer: addCors,
    configurePreviewServer: addCors,
  };
}

export default defineConfig({
  css: {
    postcss: rootPostcss,
  },
  plugins: [
    corsForRemoteEntry(),
    react(),
    federation({
      name: 'wc',
      filename: 'remoteEntry.js',
      exposes: {
        './WeeklyCommitApp': './src/WeeklyCommitApp.tsx',
        // The self-contained dashboard widget (card + compact variants); mounts standalone via its
        // own providers and calls back through onOpen(route) to ask the host to open the full module.
        './WeeklyCommitWidget': './src/widget.tsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.3.1' },
        'react-dom': { singleton: true, requiredVersion: '^18.3.1' },
        // Shared singleton so the host-provided BrowserRouter context reaches the remote's routes.
        'react-router-dom': { singleton: true, requiredVersion: '^6.26.1' },
      },
    }),
  ],
  build: {
    // Module Federation in Vite 5 requires a modern target.
    target: 'esnext',
    minify: false,
    // Emit ALL styles into ONE css file. A federated remote's CSS is NOT auto-injected into the host
    // document (the host loads remoteEntry's JS, not its CSS), so the deploy build links the remote's
    // stylesheet from the host's index.html — which only works reliably when it's a single, non-split
    // file (otherwise lazy-route chunk CSS would silently go unloaded). See deploy/Dockerfile.frontend.
    cssCodeSplit: false,
  },
  server: {
    port: 4201,
    // allowedHosts so the Dockerized browser can fetch remoteEntry.js via host.docker.internal (E2E).
    allowedHosts: true,
  },
  preview: {
    port: 4201,
    allowedHosts: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../../vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
