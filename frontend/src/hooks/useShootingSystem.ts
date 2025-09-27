// src/hooks/useShootingSystem.ts
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface ShootingSystemProps {
  isActive: boolean;
  onShoot: (hitInfo: { targetId: string | null; hitPosition: THREE.Vector3 | null }) => void;
}

export const useShootingSystem = ({ isActive, onShoot }: ShootingSystemProps) => {
  const { camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());

  useEffect(() => {
    if (!isActive) return;

    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only left click

      // Raycast from center of screen (where crosshair is)
      raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
      
      // Find all intersections
      const intersects = raycaster.current.intersectObjects(scene.children, true);
      
      // Filter for target objects (they have specific userData or name pattern)
      const targetHit = intersects.find(intersect => {
        // Check if the object or its parent has target data
        let obj = intersect.object;
        while (obj) {
          if (obj.userData?.isTarget || obj.name?.startsWith('target-')) {
            return true;
          }
          obj = obj.parent as THREE.Object3D;
        }
        return false;
      });

      if (targetHit) {
        // Find the actual target ID
        let obj = targetHit.object;
        let targetId = null;
        while (obj && !targetId) {
          if (obj.userData?.targetId) {
            targetId = obj.userData.targetId;
            break;
          }
          if (obj.name?.startsWith('target-')) {
            targetId = obj.name;
            break;
          }
          obj = obj.parent as THREE.Object3D;
        }

        console.log('🎯 Target hit!', targetId);
        onShoot({
          targetId: targetId,
          hitPosition: targetHit.point
        });
      } else {
        console.log('❌ Missed');
        onShoot({
          targetId: null,
          hitPosition: null
        });
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isActive, camera, scene, onShoot]);
};