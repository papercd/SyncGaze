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

const completeSurvey = () => {
  cy.contains('label', '기본 PC').find('input').check({ force: true });
  cy.contains('label', '시선 추적').find('input').check({ force: true });

  cy.contains('button', '발로란트').click();
  cy.get('select#mainGame').select('발로란트 (Valorant)');
  cy.get('input[name="aimTrainerUsage"][value="yes"]').check({ force: true });
  cy.get('input#inGameRank').type('Immortal 1');
  cy.get('select[name="playTime"]').select('주 7-14시간');
  cy.get('input#selfAssessment').invoke('val', 7).trigger('input');
  cy.get('textarea#trainingGoal').type('랭크 올리기');
};

const acceptConsent = () => {
  ['웹캠', '영상 보안', '데이터 활용', '참여 권리'].forEach(label => {
    cy.contains('label', label).find('input').check({ force: true });
  });
  cy.contains('button', '연구에 동의하고').click();
};

const seedSessionState = (win: Window) => {
  const session = {
    id: 'cypress-session',
    date: new Date().toISOString(),
    duration: 60,
    score: 86,
    accuracy: 86,
    targetsHit: 43,
    totalTargets: 50,
    avgReactionTime: 240,
    gazeAccuracy: 82,
    mouseAccuracy: 91,
    csvData: 'timestamp,gazeX',
    rawData: [
      {
        timestamp: 0,
        gazeX: 100,
        gazeY: 100,
        mouseX: 105,
        mouseY: 102,
        targetHit: false,
        targetId: 't1',
        targetX: 100,
        targetY: 100,
      },
      {
        timestamp: 500,
        gazeX: 102,
        gazeY: 98,
        mouseX: 101,
        mouseY: 96,
        targetHit: true,
        targetId: 't1',
        targetX: 100,
        targetY: 100,
      },
      {
        timestamp: 900,
        gazeX: 300,
        gazeY: 280,
        mouseX: 310,
        mouseY: 275,
        targetHit: true,
        targetId: 't2',
        targetX: 300,
        targetY: 280,
      },
    ],
  };

  const state = {
    surveyResponses: {
      ageCheck: true,
      webcamCheck: true,
      gamesPlayed: ['valorant'],
      mainGame: 'valorant',
      mainGameOther: '',
      aimTrainerUsage: 'yes',
      inGameRank: 'Immortal 1',
      playTime: '주 7-14시간',
      selfAssessment: 7,
      trainingGoal: '랭크 올리기',
    },
    consentAccepted: true,
    calibrationResult: { status: 'validated', validationError: 3, completedAt: new Date().toISOString() },
    recentSessions: [session],
    lastSession: session,
    activeSessionId: session.id,
    isAnonymousSession: false,
    surveyHydrated: true,
  };

  win.localStorage.setItem('trackingSessionState', JSON.stringify(state));
};

describe('tracker flow scenario', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  it('completes onboarding and reflects progress across tracker flow', () => {
    loginWithCredentials();

    cy.visit('/onboarding/survey');
    completeSurvey();
    cy.contains('button', '저장하고 계속하기').click();
    cy.url().should('include', '/dashboard');

    cy.visit('/onboarding/consent');
    acceptConsent();
    cy.url().should('include', '/calibration');

    cy.window().then(seedSessionState);
    cy.visit('/tracker-flow');

    cy.contains('연구 진행 현황').should('be.visible');
    cy.get('.status-pill')
      .should('have.length', 5)
      .each($pill => cy.wrap($pill).contains('완료'));
    cy.contains('최근 세션').parent().within(() => {
      cy.contains('43/50');
      cy.contains('86');
    });

    cy.visit('/results');
    cy.contains('트레이닝 결과').should('be.visible');
    cy.contains('SG Rank').should('be.visible');
    cy.contains('상세 분석').should('be.visible');
  });
});
