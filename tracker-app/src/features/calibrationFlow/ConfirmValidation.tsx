// tracker-app/src/components/GazeTracker/ConfirmValidation.tsx

import React from 'react';
import { useGazeTracker } from './GazeTrackerContext'; // 1. Context 훅 임포트
// GazeTracker.css의 스타일을 재사용합니다.
import './CalibrationFlow.css'; 

const ConfirmValidation: React.FC = () => {
  // 2. Context로부터 페이지 이동 핸들러(startValidation)를 가져옵니다.
  const { startValidation } = useGazeTracker();

  return (
    // 3. 기존 GazeTracker.tsx에서 사용하던 클래스명을 그대로 사용합니다.
    <div className="validation-container">
      <div className="confirmation-box">
        <h2>캘리브레이션 완료</h2>
        <p>이제 정확도 측정 단계로 진행합니다.</p>
        
        {/* 4. 버튼 클릭 시 Context의 핸들러를 호출하여 다음 페이지로 이동합니다. */}
        <button onClick={startValidation}>
          정확도 측정 시작
        </button>
      </div>
    </div>
  );
};

export default ConfirmValidation;