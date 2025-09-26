// src/hooks/useEyeTracking3D.ts
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export const useEyeTracking3D = (isActive: boolean) => {
  const { camera, size } = useThree();
  const eyeDataRef = useRef<any[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());

  useEffect(() => {
    if (!isActive) return;

    const initWebGazer = async () => {
      // @ts-ignore
      const webgazer = window.webgazer;

      webgazer
        .setGazeListener((data: any) => {
          if (data) {
            // 2D 시선 위치를 3D ray로 변환
            const x = (data.x / size.width) * 2 - 1;
            const y = -(data.y / size.height) * 2 + 1;

            raycasterRef.current.setFromCamera(
              new THREE.Vector2(x, y),
              camera
            );

            eyeDataRef.current.push({
              timestamp: performance.now(),
              screenX: data.x,
              screenY: data.y,
              worldRay: {
                origin: raycasterRef.current.ray.origin.clone(),
                direction: raycasterRef.current.ray.direction.clone()
              }
            });
          }
        })
        .begin();

      webgazer.params.showVideo = false;
      webgazer.params.showFaceOverlay = false;
      webgazer.params.showFaceFeedbackBox = false;
    };

    initWebGazer();

    return () => {
      // @ts-ignore
      window.webgazer?.end();
    };
  }, [isActive, camera, size]);

  const getEyeData = () => eyeDataRef.current;
  const clearEyeData = () => { eyeDataRef.current = []; };

  return { getEyeData, clearEyeData };
};