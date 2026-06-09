// apps/host-shell/src/main.tsx — standalone mount for the WCM dev host shell.
// Renders App into #root; federation wiring of the WC remote arrives in a later unit.
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
