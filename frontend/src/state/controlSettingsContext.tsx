import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'controlSettings';
export const DEFAULT_SENSITIVITY = 0.002;
export const MIN_SENSITIVITY = 0.0001;
export const MAX_SENSITIVITY = 0.02;

export interface ControlSettingsState {
  controlSensitivity: number;
  invertYAxis: boolean;
}

interface ControlSettingsContextValue extends ControlSettingsState {
  setControlSensitivity: (value: number) => void;
  setInvertYAxis: (value: boolean) => void;
  resetSettings: () => void;
}

const ControlSettingsContext = createContext<ControlSettingsContextValue | undefined>(undefined);

const loadSettings = (): ControlSettingsState => {
  if (typeof window === 'undefined') {
    return { controlSensitivity: DEFAULT_SENSITIVITY, invertYAxis: false };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ControlSettingsState>;
      return {
        controlSensitivity: parsed.controlSensitivity ?? DEFAULT_SENSITIVITY,
        invertYAxis: parsed.invertYAxis ?? false,
      };
    }
  } catch (error) {
    console.warn('Failed to parse control settings:', error);
  }

  return { controlSensitivity: DEFAULT_SENSITIVITY, invertYAxis: false };
};

export const ControlSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<ControlSettingsState>(loadSettings);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const setControlSensitivity = (value: number) => {
    const clamped = Math.min(Math.max(value, MIN_SENSITIVITY), MAX_SENSITIVITY);
    setSettings(prev => ({ ...prev, controlSensitivity: clamped }));
  };

  const setInvertYAxis = (value: boolean) => {
    setSettings(prev => ({ ...prev, invertYAxis: value }));
  };

  const resetSettings = () => setSettings({ controlSensitivity: DEFAULT_SENSITIVITY, invertYAxis: false });

  const value = useMemo<ControlSettingsContextValue>(() => ({
    ...settings,
    setControlSensitivity,
    setInvertYAxis,
    resetSettings,
  }), [settings]);

  return (
    <ControlSettingsContext.Provider value={value}>
      {children}
    </ControlSettingsContext.Provider>
  );
};

export const useControlSettings = () => {
  const context = useContext(ControlSettingsContext);
  if (!context) {
    throw new Error('useControlSettings must be used within a ControlSettingsProvider');
  }
  return context;
};
