// src/components/GazeTracker/constants.ts

// 카메라 미리보기 영역 + 여유 공간
export const FORBIDDEN_ZONE = { width: 340, height: 260 };

// 캘리브레이션 2단계(지점 클릭)에서 사용할 점 좌표
export const CALIBRATION_DOTS = [
  { x: '50%', y: '50%' }, // 1. Center
  { x: '50%', y: '15%' }, // 2. Top-Mid
  { x: '85%', y: '15%' }, // 3. Top-Right
  { x: '15%', y: '85%' }, // 4. Bottom-Left
  { x: '50%', y: '85%' }, // 5. Bottom-Mid
  { x: '85%', y: '85%' }, // 6. Bottom-Right
  { x: '15%', y: '50%' }, // 7. Mid-Left
  { x: '85%', y: '50%' }, // 8. Mid-Right
  { x: '35%', y: '35%' }, // 9. Inner Top-Left (safe)
];

// 과제(측정) 점 개수
export const TOTAL_TASKS = 9;