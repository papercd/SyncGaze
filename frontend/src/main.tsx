// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { TrackingSessionProvider } from './state/trackingSessionContext';
import { WebgazerProvider } from './hooks/tracking/useWebgazer';
import { AuthProvider } from './state/authContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <TrackingSessionProvider>
        <WebgazerProvider>
          <App />
        </WebgazerProvider>
      </TrackingSessionProvider>
    </AuthProvider>
  </React.StrictMode>,
);