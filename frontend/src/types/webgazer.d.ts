// src/types/webgazer.d.ts
// Global type definitions for WebGazer library

declare global {
  interface Window {
    webgazer: {
      begin(): Window['webgazer'];
      end(): Window['webgazer'];
      pause(): Window['webgazer'];
      resume(): Window['webgazer'];
      showPredictionPoints(show: boolean): Window['webgazer'];
      setGazeListener(listener: (data: { x: number; y: number } | null) => void): Window['webgazer'];
      clearGazeListener(): void;
      clearData(): void;
      setTracker(tracker: string): void;
      setRegression(regression: string): void;
      setCameraConstraints?: (constraints: MediaStreamConstraints) => void;
      applyKalmanFilter(apply: boolean): void;
      showVideo(show: boolean): void;
      showFaceOverlay(show: boolean): void;
      showFaceFeedbackBox(show: boolean): void;
      recordScreenPosition?: (x: number, y: number, type?: string) => void;
      params?: {
        checkClick?: boolean;
        checkMove?: boolean;
        [key: string]: any;
      };
    };
  }
}

export {};