// src/components/GazeTracker/Results.tsx

import React from 'react';
import { TaskResult } from './types';

interface ResultsProps {
  taskResults: TaskResult[];
  onDownload: () => void;
  screenSize: { width: number; height: number } | null;
}

const Results: React.FC<ResultsProps> = ({ taskResults, onDownload, screenSize }) => {
  const handleReload = () => window.location.reload();

  return (
    <div className="finished-container">
      <h2>측정 완료!</h2>
      <h3>데이터 요약</h3>

      {screenSize && (
        <p><strong>측정 당시 화면 크기:</strong> {screenSize.width}px &times; {screenSize.height}px</p>
      )}

      <table className="results-table">
        <thead>
          <tr>
            <th>과제 번호</th>
            <th>소요 시간 (초)</th>
            <th>시선-타겟 거리 (px)</th>
            <th>시선-클릭 거리 (px)</th>
          </tr>
        </thead>
        <tbody>
          {taskResults.map(result => (
            <tr key={result.taskId}>
              <td>{result.taskId}</td>
              <td>{(result.timeTaken / 1000).toFixed(2)}</td>
              <td>{result.gazeToTargetDistance ? result.gazeToTargetDistance.toFixed(2) : 'N/A'}</td>
              <td>{result.gazeToClickDistance ? result.gazeToClickDistance.toFixed(2) : 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="finished-controls">
        <button onClick={onDownload}>원본 데이터(CSV) 다운로드</button>
        <button onClick={handleReload}>다시 시작하기</button>
      </div>
    </div>
  );
};

export default Results;