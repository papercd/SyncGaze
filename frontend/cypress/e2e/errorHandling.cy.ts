const loginWithCredentials = () => {
  const email = Cypress.env('E2E_EMAIL');
  const password = Cypress.env('E2E_PASSWORD');

  if (!email || !password) {
    throw new Error('Set E2E_EMAIL and E2E_PASSWORD env vars to run the Cypress flow');
  }

  cy.visit('/auth');
  cy.get('input[name="email"]').clear().type(email);
  cy.get('input[name="password"]').clear().type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/dashboard');
};

const seedSessionState = (state: Record<string, unknown>) => {
  cy.visit('/onboarding/survey', {
    onBeforeLoad(win) {
      win.localStorage.setItem('trackingSessionState', JSON.stringify(state));
    },
  });
};

describe('error handling scenarios', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  it('blocks survey submission when required fields are missing', () => {
    loginWithCredentials();

    seedSessionState({
      surveyResponses: null,
      consentAccepted: false,
      calibrationResult: null,
      recentSessions: [],
      lastSession: null,
      activeSessionId: null,
      isAnonymousSession: false,
      surveyHydrated: true,
    });

    cy.contains('button', '저장하고 계속하기').click();
    cy.get('[role="alert"]').should('contain', '웹캠');
  });

  it('requires all consent checkboxes before proceeding', () => {
    loginWithCredentials();

    cy.visit('/onboarding/consent', {
      onBeforeLoad(win) {
        win.localStorage.setItem(
          'trackingSessionState',
          JSON.stringify({
            surveyResponses: {
              ageCheck: true,
              webcamCheck: true,
              gamesPlayed: ['valorant'],
              mainGame: 'valorant',
              mainGameOther: '',
              aimTrainerUsage: 'yes',
              inGameRank: 'Immortal',
              playTime: '주 7-14시간',
              selfAssessment: 6,
              trainingGoal: '랭크 올리기',
            },
            consentAccepted: false,
            calibrationResult: null,
            recentSessions: [],
            lastSession: null,
            activeSessionId: null,
            isAnonymousSession: false,
            surveyHydrated: true,
          }),
        );
      },
    });

    cy.contains('button', '연구에 동의하고').click();
    cy.get('[role="alert"]').should('contain', '모든 항목에 명시적으로 동의');
  });
});
