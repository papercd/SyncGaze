import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'crosshairSettings';

export const DEFAULT_CROSSHAIR_SETTINGS = {
  color: '#7c9bff',
  size: 12,
  thickness: 2,
  gap: 6,
};

export const CROSSHAIR_SIZE_RANGE = { min: 4, max: 32 };
export const CROSSHAIR_THICKNESS_RANGE = { min: 1, max: 10 };
export const CROSSHAIR_GAP_RANGE = { min: 0, max: 24 };

export interface CrosshairSettingsState {
  color: string;
  size: number;
  thickness: number;
  gap: number;
}

interface CrosshairSettingsContextValue extends CrosshairSettingsState {
  setCrosshairColor: (color: string) => void;
  setCrosshairSize: (value: number) => void;
  setCrosshairThickness: (value: number) => void;
  setCrosshairGap: (value: number) => void;
  resetCrosshairSettings: () => void;
}

const CrosshairSettingsContext = createContext<CrosshairSettingsContextValue | undefined>(undefined);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const loadSettings = (): CrosshairSettingsState => {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_CROSSHAIR_SETTINGS };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<CrosshairSettingsState>;
      return {
        color: parsed.color ?? DEFAULT_CROSSHAIR_SETTINGS.color,
        size: parsed.size ?? DEFAULT_CROSSHAIR_SETTINGS.size,
        thickness: parsed.thickness ?? DEFAULT_CROSSHAIR_SETTINGS.thickness,
        gap: parsed.gap ?? DEFAULT_CROSSHAIR_SETTINGS.gap,
      };
    }
  } catch (error) {
    console.warn('Failed to parse crosshair settings:', error);
  }

  return { ...DEFAULT_CROSSHAIR_SETTINGS };
};

export const CrosshairSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<CrosshairSettingsState>(loadSettings);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const setCrosshairColor = (color: string) => {
    setSettings(prev => ({ ...prev, color }));
  };

  const setCrosshairSize = (value: number) => {
    setSettings(prev => ({
      ...prev,
      size: clamp(value, CROSSHAIR_SIZE_RANGE.min, CROSSHAIR_SIZE_RANGE.max),
    }));
  };

  const setCrosshairThickness = (value: number) => {
    setSettings(prev => ({
      ...prev,
      thickness: clamp(value, CROSSHAIR_THICKNESS_RANGE.min, CROSSHAIR_THICKNESS_RANGE.max),
    }));
  };

  const setCrosshairGap = (value: number) => {
    setSettings(prev => ({
      ...prev,
      gap: clamp(value, CROSSHAIR_GAP_RANGE.min, CROSSHAIR_GAP_RANGE.max),
    }));
  };

  const resetCrosshairSettings = () => setSettings({ ...DEFAULT_CROSSHAIR_SETTINGS });

  const value = useMemo<CrosshairSettingsContextValue>(() => ({
    ...settings,
    setCrosshairColor,
    setCrosshairSize,
    setCrosshairThickness,
    setCrosshairGap,
    resetCrosshairSettings,
  }), [settings]);

  return (
    <CrosshairSettingsContext.Provider value={value}>
      {children}
    </CrosshairSettingsContext.Provider>
  );
};

export const useCrosshairSettings = () => {
  const context = useContext(CrosshairSettingsContext);
  if (!context) {
    throw new Error('useCrosshairSettings must be used within a CrosshairSettingsProvider');
  }
  return context;
};
