// apps/wc-remote/src/main.tsx — standalone mount for the WC remote during local dev.
// Renders WeeklyCommitApp into #root; the host consumes the federated export, not this file.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WeeklyCommitApp } from './WeeklyCommitApp';
import './index.css';
// WCM design-token foundation (IBM Plex @import, :root OKLCH tokens, keyframes, .btn-*/.kicker/etc).
// Imported AFTER ./index.css so the token-driven base + utility classes layer over Tailwind preflight.
// Relative path (not the @wcm/ui alias) because libs/ui's package `exports` only maps "." — a subpath
// like @wcm/ui/styles/global.css would be blocked by the exports map.
import '../../../libs/ui/src/styles/global.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

createRoot(container).render(
  <StrictMode>
    <WeeklyCommitApp />
  </StrictMode>,
);
