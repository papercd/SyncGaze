// tracker-app/src/components/GazeTracker/GazeTrackerContext.tsx

import React, { createContext, useContext } from 'react';
import {
  GameState,
  DataRecord,
  TaskResult,
  DotPosition,
  QualitySetting,
  RegressionModel,
  LiveGaze
} from './types'; // GazeTracker.tsx에서 사용하던 타입들을 가져옵니다.

// 1. Context가 하위 컴포넌트에 제공할 값들의 타입을 정의합니다.
// GazeTracker.tsx (나중에 TrackerLayout.tsx가 될)의
// 모든 state, ref, setState, handler 함수들을 포함해야 합니다.
export interface GazeTrackerContextType {
  // --- States ---
  gameState: GameState;
  isScriptLoaded: boolean;
  taskCount: number;
  currentDot: DotPosition | null;
  taskResults: TaskResult[];
  validationError: number | null;
  screenSize: { width: number; height: number } | null;
  quality: QualitySetting;
  regressionModel: RegressionModel;
  liveGaze: LiveGaze;
  recalibrationCount: number;
  gazeStability: number | null;
  calStage3SuccessRate: number | null;
  avgGazeMouseDivergence: number | null;
  avgGazeTimeToTarget: number | null;
  avgClickTimeTaken: number | null;
  avgGazeToClickError: number | null;
  isGazeDetected: boolean;
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';

  // --- State Setters ---
  // (필요한 경우 Setter도 제공할 수 있습니다. 예: quality, regressionModel)
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  setQuality: React.Dispatch<React.SetStateAction<QualitySetting>>;
  setRegressionModel: React.Dispatch<React.SetStateAction<RegressionModel>>;
  // ... (다른 setter들도 필요에 따라 추가) ...

  // --- Refs (MutableRefObject) ---
  // Ref 객체 자체를 전달하여 하위 컴포넌트가 .current에 접근할 수 있게 합니다.
  collectedData: React.MutableRefObject<DataRecord[]>;
  taskStartTime: React.MutableRefObject<number | null>;
  validationGazePoints: React.MutableRefObject<{ x: number; y: number }[]>;
  taskStartTimes: React.MutableRefObject<Record<number, number>>;

  // --- Event Handlers & Functions ---
  handleStart: () => void;
  handleCalibrationStart: () => void;
  handleCalibrationComplete: () => void;
  handleCalStage3Complete: (successRate: number) => void;
  handleRecalibrate: () => void;
  handleTaskDotClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  downloadCSV: () => void;
  analyzeTaskData: () => void; // 필요시 호출할 수 있도록
  generateCsvContent: () => string; // 필요시 호출할 수 있도록

  // --- 라우팅을 위한 새 핸들러 (TrackerLayout에서 구현) ---
  startValidation: () => void; // ConfirmValidation -> Validation 이동
  goToResults: () => void; // Validation -> Results 이동
  returnToStart: () => void; // Results -> Instructions 이동 (예시)
}

// 2. Context 객체 생성
// 초기값은 null로 설정하되, Provider는 항상 실제 값을 제공해야 합니다.
export const GazeTrackerContext = createContext<GazeTrackerContextType | null>(null);

// 3. 커스텀 훅 (Custom Hook) 생성
// 하위 컴포넌트에서 매번 useContext(GazeTrackerContext)를
// 타입 캐스팅하는 번거로움을 줄여줍니다.
export const useGazeTracker = () => {
  const context = useContext(GazeTrackerContext);

  // context가 null이면 Provider로 감싸지지 않았다는 의미이므로 에러 발생
  if (!context) {
    throw new Error('useGazeTracker must be used within a GazeTrackerProvider');
  }

  return context;
};

// 4. Provider 별도 export
export const GazeTrackerProvider = GazeTrackerContext.Provider;