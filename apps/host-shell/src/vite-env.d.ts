// apps/host-shell/src/vite-env.d.ts — ambient Vite client types for the host shell.
// Declares VITE_E2E (hermetic-E2E auth toggle, KTD13) + VITE_API_BASE so App.tsx reads them typed,
// and the federated remote module 'wc/WeeklyCommitApp' so the live MF import is type-safe.
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" enables the hermetic-E2E auth path (X-Debug-Member; auto-authenticated stub). */
  readonly VITE_E2E?: string;
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'wc/WeeklyCommitApp' {
  import type { ReactNode } from 'react';
  export interface WeeklyCommitAppProps {
    getToken?: () => Promise<string>;
    user?: { name?: string; isManager?: boolean };
    router?: (children: ReactNode) => JSX.Element;
  }
  export const WeeklyCommitApp: (props: WeeklyCommitAppProps) => JSX.Element;
  export default WeeklyCommitApp;
}
