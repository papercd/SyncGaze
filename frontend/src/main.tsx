// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { TrackingSessionProvider } from './state/trackingSessionContext';
import { WebgazerProvider } from './hooks/tracking/useWebgazer';
import { ControlSettingsProvider } from './state/controlSettingsContext';
import { CrosshairSettingsProvider } from './state/crosshairSettingsContext';
import { WeaponSettingsProvider } from './state/weaponSettingsContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TrackingSessionProvider>
      <ControlSettingsProvider>
        <WeaponSettingsProvider>
          <CrosshairSettingsProvider>
            <WebgazerProvider>
              <App />
            </WebgazerProvider>
          </CrosshairSettingsProvider>
        </WeaponSettingsProvider>
      </ControlSettingsProvider>
    </TrackingSessionProvider>
  </React.StrictMode>,
);
