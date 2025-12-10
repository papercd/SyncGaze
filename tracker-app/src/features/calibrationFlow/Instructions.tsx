// 파일 경로: papercd/syncgaze/SyncGaze-feature-tracking-demo/tracker-app/src/components/GazeTracker/Instructions.tsx

import React from 'react';
import { useGazeTracker } from './GazeTrackerContext'; // 1. Context 훅 임포트
// (필요시) GazeTracker.css의 스타일을 공유할 수 있습니다.
import './CalibrationFlow.css'; 

const Instructions: React.FC = () => {
  // 2. Props 대신 Context에서 필요한 상태와 함수를 가져옵니다.
  const { handleStart, isScriptLoaded } = useGazeTracker();

  // 3. 기존 GazeTracker.tsx의 'idle' 상태에서 렌더링하던 내용을 기반으로 UI 작성
  // (UI 내용은 예시이며, 기존 Instructions.tsx의 내용을 사용하시면 됩니다.)
  return (
    <div className="instructions-container"> {/* GazeTracker.css에 정의된 스타일 활용 */}
      <h2>시선 추적 실험 안내</h2>
      <p>실험에 참여해 주셔서 감사합니다.</p>
      <p>
        본 실험은 WebGazer.js 라이브러리를 사용하여 웹캠을 통해 사용자의 시선을 추적합니다.<br />
        정확한 데이터 수집을 위해 잠시 후 캘리브레이션(보정) 과정이 진행됩니다.
      </p>
      <p>
        <strong>준비 사항:</strong>
      </p>
      <ul>
        <li>안경이나 렌즈를 착용하셨다면 그대로 진행해 주세요.</li>
        <li>얼굴을 가리는 머리카락이나 그림자가 없는지 확인해 주세요.</li>
        <li>웹캠이 정면을 향하도록 조정해 주세요.</li>
      </ul>
      
      {/* 4. Context에서 가져온 함수와 상태를 사용합니다. */}
      <button 
        onClick={handleStart} 
        disabled={!isScriptLoaded}
        className="start-button" // GazeTracker.css의 스타일을 활용할 수 있습니다.
      >
        {isScriptLoaded ? '시작하기' : '스크립트 로딩 중...'}
      </button>
    </div>
  );
};

export default Instructions;