// main.tsx — React entry point; mounts <App/> into #root and pulls in global styles.
// Sets the initial theme on <html> before paint to avoid a flash of the wrong theme.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadTheme } from './lib/storage';
import './styles.css';

document.documentElement.dataset.theme = loadTheme();

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
