// src/components/GazeTracker/types.ts

// 게임(과제)의 진행 상태
export type GameState =
  | 'idle'
  | 'webcamCheck'
  | 'calibrating'
  | 'confirmValidation'
  | 'validating'
  | 'finished';

// 랜덤 점의 좌표
export interface DotPosition {
  x: number;
  y: number;
}

export interface LiveGaze {
  x: number | null;
  y: number | null;
}

export interface ValidationSample {
  x: number;
  y: number;
  timestamp: number;
}

export interface ValidationPointResult {
  target: DotPosition;
  meanGaze: DotPosition | null;
  sampleCount: number;
  meanError: number | null; // Target vs. mean gaze distance
  meanDistance: number | null; // Average per-sample distance to the target
  stdDev: number | null;
  minError: number | null;
  maxError: number | null;
  samples: ValidationSample[];
}

export type QualitySetting = 'low' | 'medium' | 'high';
export type RegressionModel = 'ridge' | 'threadedRidge' | 'weightedRidge';