// src/hooks/usePointerLock.ts
import { useEffect, useState } from 'react';

// ✅ 제네릭 타입을 사용하여 유연하게 처리
export const usePointerLock = <T extends HTMLElement>(
  elementRef: React.RefObject<T | null>
) => {
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handlePointerLockChange = () => {
      setIsLocked(document.pointerLockElement === element);
    };

    const handlePointerLockError = () => {
      console.error('Pointer lock failed');
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('pointerlockerror', handlePointerLockError);

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
    };
  }, [elementRef]);

  const requestPointerLock = () => {
    elementRef.current?.requestPointerLock();
  };

  const exitPointerLock = () => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  };

  return { isLocked, requestPointerLock, exitPointerLock };
};