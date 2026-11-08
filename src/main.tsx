/**
 * Browser entrypoint for MarombApp.
 * Mounts the root React application onto `#root` inside `StrictMode`.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
