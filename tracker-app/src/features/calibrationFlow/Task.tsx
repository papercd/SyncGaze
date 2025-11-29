// tracker-app/src/components/GazeTracker/Task.tsx

import React from 'react';
import { useGazeTracker } from './GazeTrackerContext'; // 1. Context 훅 임포트
import { TOTAL_TASKS } from './constants'; // 2. (원본 파일에 없었으나) TOTAL_TASKS 임포트
import './CalibrationFlow.css'; // 3. 기존 스타일 유지를 위해 CSS 임포트

// 4. props 인터페이스(TaskProps) 및 DotPosition 타입 정의 제거
// (DotPosition은 types.ts나 Context에서 관리됩니다)

// 5. 컴포넌트 시그니처에서 props 매개변수를 제거합니다.
const Task: React.FC = () => {

  // 6. Context 훅을 사용하여 GazeTracker(Layout)의 상태와 핸들러를 가져옵니다.
  const {
    taskCount,
    currentDot,
    handleTaskDotClick // 'onDotClick' 대신 'handleTaskDotClick'
  } = useGazeTracker();

  return (
    // 7. 기존의 JSX 내용과 클래스명은 그대로 유지합니다.
    <div className="task-container">
      <div className="task-info">
        진행률: {taskCount + 1} / {TOTAL_TASKS}
      </div>
      {currentDot && (
        <div
          className="task-dot"
          style={{
            top: `calc(${currentDot.y}px - 15px)`, // 15px는 점 크기의 절반
            left: `calc(${currentDot.x}px - 15px)`, // 15px는 점 크기의 절반
          }}
          // 8. Context에서 가져온 핸들러를 연결합니다.
          onClick={handleTaskDotClick} 
        />
      )}
    </div>
  );
};

export default Task;