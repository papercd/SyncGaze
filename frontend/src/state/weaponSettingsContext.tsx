import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'weaponSettings';

export interface WeaponOption {
  id: string;
  labelKey: string;
  descriptionKey: string;
  modelPath: string;
}

export const WEAPON_OPTIONS: WeaponOption[] = [
  {
    id: 'standard',
    labelKey: 'settings.weapon.option.standard',
    descriptionKey: 'settings.weapon.option.standard.desc',
    modelPath: '/glock/glock.glb',
  },
  {
    id: 'tactical',
    labelKey: 'settings.weapon.option.tactical',
    descriptionKey: 'settings.weapon.option.tactical.desc',
    modelPath: '/glock/second_glock.glb',
  },
  {
    id: 'heavy',
    labelKey: 'settings.weapon.option.heavy',
    descriptionKey: 'settings.weapon.option.heavy.desc',
    modelPath: '/glock/third_glock.glb',
  },
];

export interface WeaponSettingsState {
  selectedWeaponId: string;
}

interface WeaponSettingsContextValue extends WeaponSettingsState {
  setSelectedWeaponId: (id: string) => void;
  currentWeapon: WeaponOption;
  resetWeapon: () => void;
}

const WeaponSettingsContext = createContext<WeaponSettingsContextValue | undefined>(undefined);

const loadSettings = (): WeaponSettingsState => {
  if (typeof window === 'undefined') {
    return { selectedWeaponId: WEAPON_OPTIONS[0].id };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<WeaponSettingsState>;
      return {
        selectedWeaponId: parsed.selectedWeaponId ?? WEAPON_OPTIONS[0].id,
      };
    }
  } catch (error) {
    console.warn('Failed to parse weapon settings:', error);
  }

  return { selectedWeaponId: WEAPON_OPTIONS[0].id };
};

export const WeaponSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<WeaponSettingsState>(loadSettings);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const setSelectedWeaponId = (id: string) => setSettings({ selectedWeaponId: id });

  const resetWeapon = () => setSettings({ selectedWeaponId: WEAPON_OPTIONS[0].id });

  const currentWeapon = useMemo(() => {
    return WEAPON_OPTIONS.find(option => option.id === settings.selectedWeaponId) ?? WEAPON_OPTIONS[0];
  }, [settings.selectedWeaponId]);

  const value = useMemo<WeaponSettingsContextValue>(() => ({
    ...settings,
    currentWeapon,
    setSelectedWeaponId,
    resetWeapon,
  }), [settings, currentWeapon]);

  return (
    <WeaponSettingsContext.Provider value={value}>
      {children}
    </WeaponSettingsContext.Provider>
  );
};

export const useWeaponSettings = () => {
  const context = useContext(WeaponSettingsContext);
  if (!context) {
    throw new Error('useWeaponSettings must be used within a WeaponSettingsProvider');
  }
  return context;
};
