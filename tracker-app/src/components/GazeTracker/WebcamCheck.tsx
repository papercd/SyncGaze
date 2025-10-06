// src/components/GazeTracker/WebcamCheck.tsx

import React from 'react';

type QualitySetting = 'low' | 'medium' | 'high'; 

interface WebcamCheckProps {
  quality: QualitySetting;
  onQualityChange: (quality: QualitySetting) => void;
  onComplete: () => void;
}

const WebcamCheck: React.FC<WebcamCheckProps> = ({ quality, onQualityChange, onComplete }) => {
  return (
    <div className="instructions">
      <h3>웹캠 및 얼굴 인식 확인</h3>
      <p>캘리브레이션을 시작하기 전에, 웹캠과 얼굴 인식이 정상적으로 작동하는지 확인하세요.</p>
      <ul>
        <li>화면 왼쪽 상단에 본인의 웹캠 영상이 나타나는지 확인하세요.</li>
        <li>영상 속 얼굴에 **녹색 사각형**과 **얼굴 특징 점**들이 표시되는지 확인하세요.</li>
        <li>만약 인식이 잘 되지 않는다면, 얼굴이 정면을 향하도록 자세를 바꾸거나 주변을 더 밝게 조절해 주세요.</li>
      </ul>

      {/* 🔽 품질 선택 UI 추가 */}
      <div className="quality-selector">
        <h4>시선 추적 품질 설정</h4>
        <div className="quality-options">
          <button
            className={quality === 'low' ? 'active' : ''}
            onClick={() => onQualityChange('low')}
          >
            낮음 (성능 우선)
          </button>
          <button
            className={quality === 'medium' ? 'active' : ''}
            onClick={() => onQualityChange('medium')}
          >
            중간 (권장)
          </button>
          <button
            className={quality === 'high' ? 'active' : ''}
            onClick={() => onQualityChange('high')}
          >
            높음 (정확도 우선)
          </button>
        </div>
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button onClick={onComplete}>확인 완료, 캘리브레이션 시작</button>
      </div>
    </div>
  );
};

export default WebcamCheck;