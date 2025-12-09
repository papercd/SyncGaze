import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom provides a stub that throws; override with a no-op for router tests.
window.scrollTo = vi.fn();

// Mock WebGazer and related browser APIs that are unavailable in jsdom.
const webgazerMock = {
  setGazeListener: vi.fn().mockReturnThis(),
  setRegression: vi.fn().mockReturnThis(),
  setTracker: vi.fn().mockReturnThis(),
  begin: vi.fn().mockResolvedValue(undefined),
  end: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  showVideo: vi.fn().mockReturnThis(),
  showFaceOverlay: vi.fn().mockReturnThis(),
  showFaceFeedbackBox: vi.fn().mockReturnThis(),
  showPredictionPoints: vi.fn().mockReturnThis(),
  params: { showVideoPreview: true },
};

Object.defineProperty(window, 'webgazer', {
  writable: true,
  value: webgazerMock,
});

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// Many chart/3D libs rely on these globals.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
global.ResizeObserver = ResizeObserverMock;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
