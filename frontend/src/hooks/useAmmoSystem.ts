// src/hooks/useAmmoSystem.ts
import { useState, useCallback, useRef } from 'react';

export interface AmmoState {
  current: number;
  max: number;
  isReloading: boolean;
  isEmpty: boolean;
}

export const useAmmoSystem = (maxAmmo: number = 20) => {
  const [ammo, setAmmo] = useState<AmmoState>({
    current: maxAmmo,
    max: maxAmmo,
    isReloading: false,
    isEmpty: false
  });
  
  const reloadTimeoutRef = useRef<number | null>(null);

  const shoot = useCallback(() => {
    if (ammo.isReloading || ammo.current <= 0) {
      return false; // Can't shoot while reloading or empty
    }

    setAmmo(prev => {
      const newAmmo = prev.current - 1;
      return {
        ...prev,
        current: newAmmo,
        isEmpty: newAmmo === 0
      };
    });

    return true; // Shot fired successfully
  }, [ammo.isReloading, ammo.current]);

  const reload = useCallback((isEmptyReload: boolean = false) => {
    if (ammo.isReloading || ammo.current === ammo.max) {
      return false; // Already reloading or mag full
    }

    setAmmo(prev => ({
      ...prev,
      isReloading: true
    }));

    // Clear any existing timeout
    if (reloadTimeoutRef.current) {
      window.clearTimeout(reloadTimeoutRef.current);
    }

    // Reload duration based on animation type (from Blender 24fps)
    // ReloadEmpty: (158.4 - 85.6) / 24 = 3.033s ≈ 3033ms
    // Reload: estimate ~2000ms (adjust if you have exact frames)
    const reloadDuration = isEmptyReload ? 3033 : 2000; // ms

    reloadTimeoutRef.current = window.setTimeout(() => {
      setAmmo(prev => ({
        ...prev,
        current: prev.max,
        isReloading: false,
        isEmpty: false
      }));
    }, reloadDuration);

    return true; // Reload started
  }, [ammo.isReloading, ammo.current, ammo.max]);

  const cancelReload = useCallback(() => {
    if (reloadTimeoutRef.current) {
      window.clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = null;
    }
    setAmmo(prev => ({ ...prev, isReloading: false }));
  }, []);

  return {
    ammo,
    shoot,
    reload,
    cancelReload
  };
};