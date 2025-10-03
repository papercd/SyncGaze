// src/components/GazeTracker/Task.tsx

import React from 'react';
import { DotPosition } from './types';
import { TOTAL_TASKS } from './constants';

interface TaskProps {
  taskCount: number;
  currentDot: DotPosition | null;
  onDotClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const Task: React.FC<TaskProps> = ({ taskCount, currentDot, onDotClick }) => {
  return (
    <div>
      <p>측정: 화면에 나타나는 녹색 점을 클릭하세요. ({taskCount + 1}/{TOTAL_TASKS})</p>
      {currentDot && (
        <div
          className="task-dot"
          style={{ left: `${currentDot.x}px`, top: `${currentDot.y}px` }}
          onClick={onDotClick}
        />
      )}
    </div>
  );
};

export default Task;