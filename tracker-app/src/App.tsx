//tracker-app/src/App.tsx

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ScreenerSurvey from './components/Onboarding/ScreenerSurvey';
import ConsentForm from './components/Onboarding/ConsentForm';

// --- 캘리브레이션/검증/분석 플로우 ---
import TrackerLayout from './features/calibrationFlow/TrackerLayout';
import Instructions from './features/calibrationFlow/Instructions';
import WebcamCheck from './features/calibrationFlow/WebcamCheck';
import Calibration from './features/calibrationFlow/Calibration';
import ConfirmValidation from './features/calibrationFlow/ConfirmValidation'; // 2. 분리될 컴포넌트
import Validation from './features/calibrationFlow/Validation';
import Task from './features/calibrationFlow/Task';
import Results from './features/calibrationFlow/Results';
// ------------------------------------

function App() {
  return (
    <div className="App">
      <Routes>
        {/* 1. 기본 경로: 스크리닝 설문조사 */}
        <Route path="/" element={<ScreenerSurvey />} />
        
        {/* 2. 동의서 페이지 */}
        <Route path="/consent" element={<ConsentForm />} />
        
        {/* 3. 시선 추적 앱 (중첩 라우트 구조로 변경) */}
        <Route path="/tracker" element={<TrackerLayout />}>
          {/* /tracker 의 기본 페이지 */}
          <Route index element={<Instructions />} /> 
          {/* /tracker/webcam-check */}
          <Route path="webcam-check" element={<WebcamCheck />} /> 
          {/* /tracker/calibrate */}
          <Route path="calibrate" element={<Calibration />} />
          {/* /tracker/confirm-validation */}
          <Route path="confirm-validation" element={<ConfirmValidation />} />
          {/* /tracker/validate */}
          <Route path="validate" element={<Validation />} />
          {/* /tracker/task */}
          <Route path="task" element={<Task />} />
          {/* /tracker/results */}
          <Route path="results" element={<Results />} />
        </Route>

        {/* 기타 예외 경로 처리 */}
        <Route path="*" element={<div>페이지를 찾을 수 없습니다.</div>} />
      </Routes>
    </div>
  );
}

export default App;