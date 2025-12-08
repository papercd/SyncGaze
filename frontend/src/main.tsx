// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { TrackingSessionProvider } from './state/trackingSessionContext';
import { WebgazerProvider } from './hooks/tracking/useWebgazer';
import { ControlSettingsProvider } from './state/controlSettingsContext';
import { CrosshairSettingsProvider } from './state/crosshairSettingsContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TrackingSessionProvider>
      <ControlSettingsProvider>
        <CrosshairSettingsProvider>
          <WebgazerProvider>
            <App />
          </WebgazerProvider>
        </CrosshairSettingsProvider>
      </ControlSettingsProvider>
    </TrackingSessionProvider>
  </React.StrictMode>,
);
