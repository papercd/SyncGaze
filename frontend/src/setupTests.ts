import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom provides a stub that throws; override with a no-op for router tests.
window.scrollTo = vi.fn();
