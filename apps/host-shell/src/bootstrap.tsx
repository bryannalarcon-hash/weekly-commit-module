// apps/host-shell/src/bootstrap.tsx — the real host mount, loaded behind main.tsx's async boundary so
// the Module Federation runtime + shared singletons are ready first. Renders <App/> (which lazy-loads
// the WC remote over MF) into #root. Kept separate from main.tsx purely to satisfy the MF init order.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
