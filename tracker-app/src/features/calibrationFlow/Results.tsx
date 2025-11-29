// tracker-app/src/components/GazeTracker/Results.tsx

import React from 'react';
// 1. TaskResult 타입을 types.ts에서 직접 가져옵니다. (기존과 동일)
import { TaskResult } from './types'; 
import { useGazeTracker } from './GazeTrackerContext'; // 2. Context 훅 임포트
import './CalibrationFlow.css'; // 3. 기존 스타일 유지를 위해 CSS 임포트

// 4. props 인터페이스(ResultsProps) 정의 제거

// 5. 컴포넌트 시그니처에서 props 매개변수를 제거합니다.
const Results: React.FC = () => {

  // 6. Context 훅을 사용하여 GazeTracker(Layout)의 모든 상태와 핸들러를 가져옵니다.
  const {
    taskResults,
    downloadCSV, // 'onDownload' 대신 'downloadCSV'
    screenSize,
    avgGazeMouseDivergence,
    avgGazeTimeToTarget,
    avgClickTimeTaken,
    avgGazeToClickError,
    uploadStatus, // (신규) 업로드 상태
    returnToStart // (신규) 다시 시작 핸들러
  } = useGazeTracker();

  // (신규) 업로드 상태를 표시하는 헬퍼 컴포넌트
  const UploadStatusDisplay: React.FC = () => {
    let message = '';
    let className = '';

    switch (uploadStatus) {
      case 'uploading':
        message = '결과 자동 업로드 중... 창을 닫지 마세요.';
        className = 'status-pending';
        break;
      case 'success':
        message = '데이터가 성공적으로 업로드되었습니다.';
        className = 'status-success';
        break;
      case 'error':
        message = '데이터 업로드 실패. 수동으로 CSV를 다운로드하세요.';
        className = 'status-error';
        break;
      default: // 'idle' (이론상 finished 상태에서는 idle이 아니어야 함)
        return null;
    }

    return (
      <div className={`detection-status-container ${className}`} style={{ marginBottom: '20px' }}>
        <h4>{message}</h4>
      </div>
    );
  };

  return (
    // 7. 기존의 JSX 내용과 클래스명은 그대로 유지합니다.
    <div className="results-container">
      <h2>실험 완료!</h2>
      <p>실험에 참여해 주셔서 감사합니다. 아래는 측정된 데이터의 요약입니다.</p>

      {/* (신규) 업로드 상태 표시 */}
      <UploadStatusDisplay />

      {/* 1. 요약 통계 테이블 */}
      <h3>요약 통계 (Derived Metrics)</h3>
      <table className="results-table">
        <thead>
          <tr>
            <th>지표 (Metric)</th>
            <th>값 (Value)</th>
            <th>설명</th>
          </tr>
        </thead>
        <tbody>
          {/* Context의 값들을 사용합니다 */}
          <tr>
            <td>평균 클릭 소요 시간</td>
            <td><strong>{avgClickTimeTaken !== null ? `${avgClickTimeTaken.toFixed(2)} ms` : 'N/A'}</strong></td>
            <td>과제 점이 나타난 순간부터 클릭하기까지 걸린 평균 시간</td>
          </tr>
          <tr>
            <td>평균 시선-클릭 오차</td>
            <td><strong>{avgGazeToClickError !== null ? `${avgGazeToClickError.toFixed(2)} px` : 'N/A'}</strong></td>
            <td>점을 클릭하는 순간의 시선과 실제 클릭 위치 간의 평균 거리</td>
          </tr>
          <tr>
            <td>평균 시선-마우스 이격도</td>
            <td><strong>{avgGazeMouseDivergence !== null ? `${avgGazeMouseDivergence.toFixed(2)} px` : 'N/A'}</strong></td>
            <td>과제 수행 중 시선과 마우스 커서 간의 평균 거리</td>
          </tr>
          <tr>
            <td>평균 시선 반응 속도 (TTT)</td>
            <td><strong>{avgGazeTimeToTarget !== null ? `${avgGazeTimeToTarget.toFixed(2)} ms` : 'N/A'}</strong></td>
            <td>과제 점이 나타난 후 시선이 점의 100px 반경 내로 도달하기까지 걸린 평균 시간</td>
          </tr>
        </tbody>
      </table>

      {/* 2. 개별 과제 결과 테이블 */}
      <h3>개별 과제 결과 (Task Results)</h3>
      <table className="results-table individual-results">
        <thead>
          <tr>
            <th>과제 ID</th>
            <th>소요 시간 (ms)</th>
            <th>시선-타겟 오차 (px)</th>
            <th>시선-클릭 오차 (px)</th>
          </tr>
        </thead>
        <tbody>
          {taskResults.map((result, index) => (
            <tr key={index}>
              <td>{result.taskId}</td>
              <td>{result.timeTaken.toFixed(2)}</td>
              <td>{result.gazeToTargetDistance !== null ? result.gazeToTargetDistance.toFixed(2) : 'N/A'}</td>
              <td>{result.gazeToClickDistance !== null ? result.gazeToClickDistance.toFixed(2) : 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* 3. 환경 정보 (참고) */}
      <p style={{ marginTop: '20px', fontSize: '0.9em', color: '#666' }}>
        * 참고: 실험은 {screenSize ? `${screenSize.width}x${screenSize.height}` : 'N/A'} 해상도 환경에서 진행되었습니다.
      </p>

      {/* 4. 다운로드 버튼 (핸들러만 변경) */}
      <p>
        모든 원시 데이터(시선 좌표, 마우스 좌표)와 위 요약 지표가 포함된 CSV 파일을 다운로드할 수 있습니다.
        {uploadStatus === 'error' && <strong> (업로드 실패. 반드시 다운로드하세요!)</strong>}
      </p>
      
      <div className="results-actions"> {/* (신규) 버튼 그룹 */}
        <button onClick={downloadCSV} className="download-button">
          CSV 데이터 다운로드
        </button>
        <button onClick={returnToStart} className="recalibrate-button">
          처음으로 돌아가기
        </button>
      </div>
    </div>
  );
};

export default Results;