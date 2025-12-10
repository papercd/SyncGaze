export type GameState =
  | 'idle'
  | 'webcamCheck'
  | 'calibrating'
  | 'confirmValidation'
  | 'validating'
  | 'validationResult';
export type QualitySetting = 'low' | 'medium' | 'high';

export interface DotPosition {
  x: number;
  y: number;
}

export interface LiveGaze {
  x: number | null;
  y: number | null;
}

export interface CalibrationProps {
  onComplete: () => void;
  liveGaze: LiveGaze;
  onCalStage3Complete: (successRate: number) => void;
}