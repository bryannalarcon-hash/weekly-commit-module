// apps/wc-remote/src/vite-env.d.ts — ambient Vite client types for the remote app.
// Also declares the VITE_AUTH0_* / VITE_API_BASE env the AuthProvider + commitApi read so they are
// typed (and empty-safe) without a live Auth0 tenant during tests/build.
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH0_DOMAIN?: string;
  readonly VITE_AUTH0_CLIENT_ID?: string;
  readonly VITE_AUTH0_AUDIENCE?: string;
  readonly VITE_AUTH0_SCOPE?: string;
  readonly VITE_API_BASE?: string;
  /** "true" enables the hermetic-E2E auth path (X-Debug-Member; auto-authenticated). KTD13. */
  readonly VITE_E2E?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
