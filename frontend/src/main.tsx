// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { TrackingSessionProvider } from './state/trackingSessionContext';
import { WebgazerProvider } from './hooks/tracking/useWebgazer';
import { ControlSettingsProvider } from './state/controlSettingsContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TrackingSessionProvider>
      <ControlSettingsProvider>
        <WebgazerProvider>
          <App />
        </WebgazerProvider>
      </ControlSettingsProvider>
    </TrackingSessionProvider>
  </React.StrictMode>,
);