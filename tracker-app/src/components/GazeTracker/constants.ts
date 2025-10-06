// src/components/GazeTracker/constants.ts

// 카메라 미리보기 영역 + 여유 공간
export const FORBIDDEN_ZONE = { width: 340, height: 260 };

// 캘리브레이션 2단계(지점 클릭)에서 사용할 점 좌표
export const CALIBRATION_DOTS = [
  // 1 Center
  { x: '50%', y: '50%' },
  
  // 4 Corners (좌상단 제외) 및 안전한 좌상단 영역
  { x: '95%', y: '5%' },   // 2. Top-Right
  { x: '5%', y: '95%' },   // 3. Bottom-Left
  { x: '95%', y: '95%' },  // 4. Bottom-Right
  { x: '25%', y: '40%' },  // 5. [수정됨] Safe Top-Left
  
  // 4 Edges
  { x: '50%', y: '5%' },   // 6. Top-Center
  { x: '50%', y: '95%' },  // 7. Bottom-Center
  { x: '5%', y: '50%' },   // 8. Mid-Left
  { x: '95%', y: '50%' },  // 9. Mid-Right
  
  // 4 Inner Points (좌상단 제외) 및 안전한 내부 좌상단 영역
  { x: '75%', y: '25%' },  // 10. Inner Top-Right
  { x: '25%', y: '75%' },  // 11. Inner Bottom-Left
  { x: '75%', y: '75%' },  // 12. Inner Bottom-Right
  { x: '35%', y: '35%' },  // 13. [수정됨] Safe Inner Top-Left
];

// 과제(측정) 점 개수
export const TOTAL_TASKS = 9;