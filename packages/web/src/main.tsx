import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

// Hash routing, not history: the app ships as a folder of static files dropped
// on whatever internal server is available, and a plain file server has no way
// to rewrite `/comparisons/<id>` back to `index.html` — it would answer 404.
createRoot(rootElement).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
