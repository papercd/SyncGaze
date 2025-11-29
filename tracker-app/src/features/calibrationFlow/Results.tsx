// tracker-app/src/components/GazeTracker/Results.tsx

import React, { useEffect, useMemo, useRef } from 'react';
import { useGazeTracker } from './GazeTrackerContext';
import './CalibrationFlow.css';

const ValidationHeatmap: React.FC<{
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  records: ReturnType<typeof useGazeTracker>['validationRecords'];
}> = ({ width, height, sourceWidth, sourceHeight, records }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const scaleX = width / sourceWidth;
    const scaleY = height / sourceHeight;
    const radiusScale = Math.max(scaleX, scaleY);

    const glowRadius = 70;
    records.forEach(record => {
      record.samples.forEach(sample => {
        const x = sample.x * scaleX;
        const y = sample.y * scaleY;
        const gradient = ctx.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          glowRadius * radiusScale
        );
        gradient.addColorStop(0, 'rgba(102, 126, 234, 0.35)');
        gradient.addColorStop(1, 'rgba(102, 126, 234, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(
          x - glowRadius * radiusScale,
          y - glowRadius * radiusScale,
          glowRadius * 2 * radiusScale,
          glowRadius * 2 * radiusScale
        );
      });
    });

    ctx.lineWidth = 2;
    ctx.font = '14px sans-serif';
    records.forEach((record, idx) => {
      const targetX = record.target.x * scaleX;
      const targetY = record.target.y * scaleY;
      ctx.beginPath();
      ctx.strokeStyle = '#0ec7a7';
      ctx.fillStyle = 'rgba(14, 199, 167, 0.25)';
      ctx.arc(targetX, targetY, 12 * radiusScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0ec7a7';
      ctx.fillText(`${idx + 1}`, targetX + 16, targetY + 4);
    });
  }, [width, height, sourceHeight, sourceWidth, records]);

  return (
    <div className="heatmap-card" style={{ aspectRatio: `${width}/${height}` }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

const Results: React.FC = () => {
  const {
    downloadCSV,
    screenSize,
    uploadStatus,
    returnToStart,
    validationRecords,
    validationError,
    gazeStability,
    validationDurationMs,
  } = useGazeTracker();

  const validationSamples = useMemo(
    () => validationRecords.reduce((acc, record) => acc + record.sampleCount, 0),
    [validationRecords]
  );

  const avgSampleError = useMemo(() => {
    const distances = validationRecords
      .map(record => record.meanDistance)
      .filter((v): v is number => v !== null);
    if (!distances.length) return null;
    return distances.reduce((acc, v) => acc + v, 0) / distances.length;
  }, [validationRecords]);

  const sourceWidth = screenSize?.width ?? 1280;
  const sourceHeight = screenSize?.height ?? 720;
  const displayWidth = Math.min(1200, Math.round(sourceWidth * 0.95));
  const aspectRatio = sourceWidth > 0 ? sourceHeight / sourceWidth : 0.75;
  const displayHeight = Math.round(displayWidth * aspectRatio);

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
      default:
        return null;
    }

    return (
      <div className={`detection-status-container ${className}`} style={{ marginBottom: '20px' }}>
        <h4>{message}</h4>
      </div>
    );
  };

  return (
    <div className="results-container">
      <h2>실험 완료!</h2>
      <p>9점 고정 응시 검증과 캘리브레이션을 마쳤습니다. 아래에서 정확도와 분포를 확인하세요.</p>

      <UploadStatusDisplay />

      <section className="results-section">
        <h3>검증 요약</h3>
        <div className="summary-grid">
          <div className="summary-card">
            <p className="eyebrow">평균 오차 (타겟 vs. 평균 시선)</p>
            <strong>{validationError !== null ? `${validationError.toFixed(2)} px` : 'N/A'}</strong>
          </div>
          <div className="summary-card">
            <p className="eyebrow">평균 표준편차</p>
            <strong>{gazeStability !== null ? `${gazeStability.toFixed(2)} px` : 'N/A'}</strong>
          </div>
          <div className="summary-card">
            <p className="eyebrow">평균 샘플 오차</p>
            <strong>{avgSampleError !== null ? `${avgSampleError.toFixed(2)} px` : 'N/A'}</strong>
          </div>
          <div className="summary-card">
            <p className="eyebrow">수집된 샘플 수</p>
            <strong>{validationSamples}</strong>
          </div>
        </div>
        <p className="summary-note">
          각 지점을 {validationDurationMs / 1000}초씩 응시해 수집한 시선 좌표를 기반으로 오차(타겟↔평균 시선)와 분산을 계산했습니다.
        </p>
      </section>

      <section className="results-section">
        <h3>히트맵 및 타겟 분포</h3>
        {validationRecords.length > 0 ? (
          <ValidationHeatmap
            width={displayWidth}
            height={displayHeight}
            sourceWidth={sourceWidth}
            sourceHeight={sourceHeight}
            records={validationRecords}
          />
        ) : (
          <p className="summary-note">아직 검증 데이터가 없습니다.</p>
        )}
        <p className="summary-note">녹색 원은 실제 검증 타겟 위치, 파란 빛 번짐은 해당 지점 근처에서 기록된 시선 분포입니다.</p>
      </section>

      <section className="results-section">
        <h3>9개 지점 결과 한눈에 보기</h3>
        {validationRecords.length > 0 ? (
          <div className="validation-grid-summary">
            {validationRecords.map((record, idx) => (
              <div key={`${record.target.x}-${record.target.y}-${idx}`} className="validation-summary-card">
                <div className="summary-card-header">#{idx + 1}</div>
                <div className="summary-card-body">
                  <div className="summary-row"><span>위치</span><strong>{record.target.x}px, {record.target.y}px</strong></div>
                  <div className="summary-row"><span>샘플</span><strong>{record.sampleCount}</strong></div>
                  <div className="summary-row"><span>오차</span><strong>{record.meanError !== null ? `${record.meanError.toFixed(2)} px` : 'N/A'}</strong></div>
                  <div className="summary-row"><span>표준편차</span><strong>{record.stdDev !== null ? `${record.stdDev.toFixed(2)} px` : 'N/A'}</strong></div>
                  <div className="summary-row"><span>최소/최대</span><strong>
                    {record.minError !== null ? record.minError.toFixed(2) : 'N/A'}px /
                    {record.maxError !== null ? ` ${record.maxError.toFixed(2)}px` : ' N/A'}
                  </strong></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="summary-note">검증 데이터를 먼저 수집해 주세요.</p>
        )}
      </section>

      <section className="results-section">
        <h3>지점별 검증 결과</h3>
        <div className="results-table-container">
          <table>
            <thead>
              <tr>
                <th>지점</th>
                <th>위치 (px)</th>
                <th>샘플 수</th>
                <th>오차 (타겟↔평균)</th>
                <th>평균 샘플 오차</th>
                <th>표준편차</th>
                <th>최소/최대 오차</th>
              </tr>
            </thead>
            <tbody>
              {validationRecords.map((record, idx) => (
                <tr key={`${record.target.x}-${record.target.y}-${idx}`}>
                  <td>#{idx + 1}</td>
                  <td>{record.target.x}px, {record.target.y}px</td>
                  <td>{record.sampleCount}</td>
                  <td>{record.meanError !== null ? `${record.meanError.toFixed(2)} px` : 'N/A'}</td>
                  <td>{record.meanDistance !== null ? `${record.meanDistance.toFixed(2)} px` : 'N/A'}</td>
                  <td>{record.stdDev !== null ? `${record.stdDev.toFixed(2)} px` : 'N/A'}</td>
                  <td>
                    {record.minError !== null ? record.minError.toFixed(2) : 'N/A'} px /
                    {record.maxError !== null ? ` ${record.maxError.toFixed(2)} px` : ' N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p style={{ marginTop: '20px', fontSize: '0.9em', color: '#666' }}>
        * 참고: 실험은 {screenSize ? `${screenSize.width}x${screenSize.height}` : 'N/A'} 해상도 환경에서 진행되었습니다.
      </p>

      <p>
        모든 원시 데이터(시선 좌표, 마우스 좌표)와 위 요약 지표가 포함된 CSV 파일을 다운로드할 수 있습니다.
        {uploadStatus === 'error' && <strong> (업로드 실패. 반드시 다운로드하세요!)</strong>}
      </p>

      <div className="results-actions">
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