// src/components/GazeTracker/Instructions.tsx

import React from 'react';

interface InstructionsProps {
  onStart: () => void;
  isScriptLoaded: boolean;
}

const Instructions: React.FC<InstructionsProps> = ({ onStart, isScriptLoaded }) => {
  return (
    <div>
      <div className="instructions">
        <h3>정확도 향상을 위한 핵심 원리 (사용자 안내)</h3>
        <p>WebGazer.js는 사용자의 얼굴 특징(특히 눈)과 화면 위 마우스 포인터의 위치 관계를 학습합니다. 따라서 정확한 학습을 위해서는 아래의 환경과 자세가 매우 중요합니다.</p>
        <ul>
          <li><strong>자세 고정:</strong> 캘리브레이션을 진행하는 동안에는 머리와 상체를 최대한 움직이지 않고 고정해야 합니다.</li>
          <li><strong>정확한 클릭:</strong> 점을 클릭할 때, 점을 먼저 응시한 후, 시선이 고정된 상태에서 클릭하는 것이 중요합니다.</li>
          <li><strong>좋은 환경:</strong> 안경에 빛이 반사되거나, 얼굴에 그림자가 지거나, 배경이 너무 복잡하면 시선 추적의 정확도가 떨어질 수 있습니다.</li>
        </ul>
      </div>
      <p>준비가 되셨다면 아래 버튼을 눌러 시작해 주세요.<br/>
      <strong>측정시작</strong> 버튼을 누르면 캘리브레이션 후, 시선 및 마우스 추적 측정이 시작됩니다.</p>
      <button onClick={onStart} disabled={!isScriptLoaded}>
        {isScriptLoaded ? '측정 시작' : '스크립트 로딩 중...'}
      </button>
    </div>
  );
};

export default Instructions;