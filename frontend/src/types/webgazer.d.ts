// frontend/src/types/webgazer.d.ts
interface Window {
    webgazer?: {
      begin: () => void;
      end: () => void;
      setGazeListener: (listener: (data: { x: number; y: number } | null) => void) => any;
      clearGazeListener: () => void;
      showPredictionPoints: (show: boolean) => any;
      clearData: () => void;
      params: {
        showVideo: boolean;
        showFaceOverlay: boolean;
        showFaceFeedbackBox: boolean;
      };
    };
  }