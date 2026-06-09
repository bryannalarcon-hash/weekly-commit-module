// apps/wc-remote/src/main.tsx — standalone mount for the WC remote during local dev.
// Renders WeeklyCommitApp into #root; the host consumes the federated export, not this file.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WeeklyCommitApp } from './WeeklyCommitApp';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

createRoot(container).render(
  <StrictMode>
    <WeeklyCommitApp />
  </StrictMode>,
);
