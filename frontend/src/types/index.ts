// src/types/index.ts
import * as THREE from 'three';

export interface Target3D {
  id: string;
  position: THREE.Vector3;
  radius: number;
  spawnTime: number;
  hitTime?: number;
  type: 'static' | 'moving';
  velocity?: THREE.Vector3;
  mesh?: THREE.Mesh;  // Three.js mesh 참조
}

export interface CameraData {
  timestamp: number;
  rotation: {
    x: number;  // pitch
    y: number;  // yaw
    z: number;  // roll (보통 0)
  };
  quaternion: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
}

export interface MouseData3D {
  timestamp: number;
  movementX: number;     // raw mouse delta
  movementY: number;
  screenX: number;       // 2D screen position
  screenY: number;
  worldRay?: {           // 3D ray from camera
    origin: THREE.Vector3;
    direction: THREE.Vector3;
  };
  eventType: 'move' | 'click';
  targetHit?: string;    // target ID if hit
}

export interface EyeData {
  timestamp: number;
  screenX: number;       // 2D gaze position
  screenY: number;
  worldRay?: {           // 3D ray from gaze
    origin: THREE.Vector3;
    direction: THREE.Vector3;
  };
  confidence: number;
}

export interface SyncedEvent3D {
  timestamp: number;
  mouse: MouseData3D;
  eye: EyeData;
  camera: CameraData;
  target: Target3D | null;
  distanceToTarget?: number;  // 조준점-타겟 거리
}