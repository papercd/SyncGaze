import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SurveyPage from '../onboarding/SurveyPage';
import { TrackingSessionProvider } from '../../state/trackingSessionContext';

describe('SurveyPage', () => {
  const originalFetch = globalThis.fetch;
  const originalAlert = window.alert;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.alert = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.alert = originalAlert;
    globalThis.fetch = originalFetch;
  });

  it('submits valid survey responses and navigates to dashboard', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response),
    ) as unknown as typeof fetch;
    globalThis.fetch = mockFetch;

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/onboarding/survey']}>
        <TrackingSessionProvider>
          <Routes>
            <Route path="/onboarding/survey" element={<SurveyPage />} />
            <Route path="/dashboard" element={<div>Dashboard Destination</div>} />
          </Routes>
        </TrackingSessionProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText(/PC\/네트워크 환경이 준비/));
    await user.click(screen.getByLabelText(/웹캠\/카메라가 있습니다/));
    await user.click(screen.getByRole('button', { name: 'Valorant' }));
    await user.click(screen.getByLabelText('Valorant'));
    await user.type(screen.getByPlaceholderText(/예: 실버 2/), 'Immortal 2');
    await user.selectOptions(screen.getByLabelText(/얼마나 자주 플레이/), '주 7-14시간');
    fireEvent.change(screen.getByLabelText(/현재 에임/), { target: { value: '6' } });
    await user.type(screen.getByLabelText(/이번 시즌에 꼭 달성하고 싶은 목표/), '랭크 올리기');

    await user.click(screen.getByRole('button', { name: /저장하고 계속하기/ }));

    await waitFor(() => {
      expect(screen.getByText('Dashboard Destination')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/submit-survey',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
