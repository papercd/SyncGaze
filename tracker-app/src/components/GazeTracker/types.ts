// src/components/GazeTracker/types.ts

// 게임(과제)의 진행 상태
export type GameState = 'idle' | 'webcamCheck' | 'calibrating' | 'confirmValidation' | 'validating' | 'task' | 'finished';

// 수집할 원본 데이터
export interface DataRecord {
  timestamp: number;
  taskId: number | null;
  targetX: number | null;
  targetY: number | null;
  gazeX: number | null;
  gazeY: number | null;
  mouseX: number | null;
  mouseY: number | null;
}

// 최종 결과 요약 데이터
export interface TaskResult {
  taskId: number;
  timeTaken: number;
  gazeToTargetDistance: number | null;
  gazeToClickDistance: number | null;
}

// 랜덤 점의 좌표
export interface DotPosition {
  x: number;
  y: number;
}