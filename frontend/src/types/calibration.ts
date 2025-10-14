// frontend/src/types/calibration.ts

/**
 * Calibration stage type
 * Stage 1: Smooth pursuit (circular motion)
 * Stage 2: Point calibration (13-point grid with 3 clicks each)
 * Stage 3: Final refinement (Lissajous curve with gaze feedback)
 */
export type CalibrationStage = 1 | 2 | 3;

/**
 * Calibration dot position for stage 2 (point calibration)
 */
export interface CalibrationDot {
  x: string;  // CSS position (e.g., '50%')
  y: string;  // CSS position (e.g., '50%')
}

/**
 * Live gaze data from WebGazer
 */
export interface LiveGaze {
  x: number | null;
  y: number | null;
}

/**
 * Props for the main Calibration component
 */
export interface CalibrationProps {
  onComplete: () => void;
  liveGaze: LiveGaze;
}

/**
 * Props for stage instruction screens
 */
export interface StageInstructionProps {
  stage: CalibrationStage;
  onStart: () => void;
}