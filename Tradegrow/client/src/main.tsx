import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerServiceWorker } from './utils/notifications';
import './index.css';

// Auto-reload to latest bundle when a dynamic chunk fails to load after a production deployment
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  window.location.reload();
});

registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
