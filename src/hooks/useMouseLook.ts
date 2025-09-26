// src/hooks/useMouseLook.ts
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface MouseLookData {
  timestamp: number;
  movementX: number;
  movementY: number;
  rotation: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
}

export const useMouseLook = (
  sensitivity: number = 0.002,
  isActive: boolean = false
) => {
  const { camera } = useThree();
  const mouseDataRef = useRef<MouseLookData[]>([]);
  const eulerRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const velocityRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!isActive) return;

    const handleMouseMove = (event: MouseEvent) => {
      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      // Apply smoothing for more natural movement
      velocityRef.current.x = movementX * sensitivity;
      velocityRef.current.y = movementY * sensitivity;

      // Update camera rotation (FPS style)
      eulerRef.current.setFromQuaternion(camera.quaternion);
      eulerRef.current.y -= velocityRef.current.x;
      eulerRef.current.x -= velocityRef.current.y;

      // Clamp pitch (vertical rotation) to prevent flipping
      const maxPitch = Math.PI / 2 - 0.1; // Slightly less than 90 degrees
      eulerRef.current.x = Math.max(
        -maxPitch,
        Math.min(maxPitch, eulerRef.current.x)
      );

      camera.quaternion.setFromEuler(eulerRef.current);

      // Collect data
      mouseDataRef.current.push({
        timestamp: performance.now(),
        movementX,
        movementY,
        rotation: {
          x: eulerRef.current.x,
          y: eulerRef.current.y,
          z: eulerRef.current.z
        },
        quaternion: {
          x: camera.quaternion.x,
          y: camera.quaternion.y,
          z: camera.quaternion.z,
          w: camera.quaternion.w
        }
      });

      // Keep only recent data (last 5 seconds)
      const cutoffTime = performance.now() - 5000;
      if (mouseDataRef.current.length > 1000) {
        mouseDataRef.current = mouseDataRef.current.filter(
          d => d.timestamp > cutoffTime
        );
      }
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [camera, sensitivity, isActive]);

  const getMouseData = () => mouseDataRef.current;
  const clearMouseData = () => { mouseDataRef.current = []; };

  return { getMouseData, clearMouseData };
};