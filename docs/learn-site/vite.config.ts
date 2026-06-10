// vite.config.ts — Vite build config for the standalone WCM learn-site.
// base:'./' makes dist/ portable (openable when served from any path); React plugin enables JSX.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
});
