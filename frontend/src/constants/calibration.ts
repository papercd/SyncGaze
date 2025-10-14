// frontend/src/constants/calibration.ts

import { CalibrationDot } from '../types/calibration';

/**
 * 13-point calibration grid for Stage 2
 * Points are strategically placed to cover the entire screen
 * while avoiding the camera preview area (top-left)
 */
export const CALIBRATION_DOTS: CalibrationDot[] = [
  // 1. Center (most important)
  { x: '50%', y: '50%' },
  
  // 2-5. Corners (avoiding problematic top-left)
  { x: '95%', y: '5%' },   // Top-Right
  { x: '5%', y: '95%' },   // Bottom-Left
  { x: '95%', y: '95%' },  // Bottom-Right
  { x: '25%', y: '40%' },  // Safe Top-Left (moved away from camera)
  
  // 6-9. Edge midpoints
  { x: '50%', y: '5%' },   // Top-Center
  { x: '50%', y: '95%' },  // Bottom-Center
  { x: '5%', y: '50%' },   // Mid-Left
  { x: '95%', y: '50%' },  // Mid-Right
  
  // 10-13. Inner quadrant points
  { x: '75%', y: '25%' },  // Inner Top-Right
  { x: '25%', y: '75%' },  // Inner Bottom-Left
  { x: '75%', y: '75%' },  // Inner Bottom-Right
  { x: '35%', y: '35%' },  // Safe Inner Top-Left
];

/**
 * Number of clicks required per dot in Stage 2
 */
export const CLICKS_PER_DOT = 3;

/**
 * Duration for Stage 1 smooth pursuit (milliseconds)
 */
export const STAGE_1_DURATION = 18000; // 18 seconds

/**
 * Duration for Stage 3 refinement (milliseconds)
 */
export const STAGE_3_DURATION = 20000; // 20 seconds

/**
 * Radius for determining if gaze is "on target" in Stage 3 (pixels)
 */
export const DWELL_RADIUS_PX = 150;