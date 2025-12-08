// src/state/soundSettingsContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SoundSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
}

interface SoundSettingsContextType extends SoundSettings {
  setMasterVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  resetToDefaults: () => void;
}

const defaultSettings: SoundSettings = {
  masterVolume: 0.7,
  sfxVolume: 1.0,
  musicVolume: 0.5,
  muted: false,
};

const SoundSettingsContext = createContext<SoundSettingsContextType | undefined>(undefined);

export const SoundSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SoundSettings>(() => {
    const stored = localStorage.getItem('soundSettings');
    return stored ? JSON.parse(stored) : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('soundSettings', JSON.stringify(settings));
  }, [settings]);

  const setMasterVolume = (volume: number) => {
    setSettings(prev => ({ ...prev, masterVolume: Math.max(0, Math.min(1, volume)) }));
  };

  const setSfxVolume = (volume: number) => {
    setSettings(prev => ({ ...prev, sfxVolume: Math.max(0, Math.min(1, volume)) }));
  };

  const setMusicVolume = (volume: number) => {
    setSettings(prev => ({ ...prev, musicVolume: Math.max(0, Math.min(1, volume)) }));
  };

  const setMuted = (muted: boolean) => {
    setSettings(prev => ({ ...prev, muted }));
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
  };

  return (
    <SoundSettingsContext.Provider
      value={{
        ...settings,
        setMasterVolume,
        setSfxVolume,
        setMusicVolume,
        setMuted,
        resetToDefaults,
      }}
    >
      {children}
    </SoundSettingsContext.Provider>
  );
};

export const useSoundSettings = () => {
  const context = useContext(SoundSettingsContext);
  if (!context) {
    throw new Error('useSoundSettings must be used within SoundSettingsProvider');
  }
  return context;
};