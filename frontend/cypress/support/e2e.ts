// Global Cypress support: stub browser APIs that aren't available in headless runs.

const buildWebgazerMock = () => ({
  setGazeListener: cy.stub().returnsThis(),
  setRegression: cy.stub().returnsThis(),
  setTracker: cy.stub().returnsThis(),
  begin: cy.stub().resolves(),
  end: cy.stub(),
  pause: cy.stub(),
  resume: cy.stub(),
  showVideo: cy.stub().returnsThis(),
  showFaceOverlay: cy.stub().returnsThis(),
  showFaceFeedbackBox: cy.stub().returnsThis(),
  showPredictionPoints: cy.stub().returnsThis(),
  params: { showVideoPreview: true },
});

Cypress.on('uncaught:exception', (err) => {
  // Ignore WebGazer/tfjs asset load failures during headless tests.
  if (/webgazer|tfjs-model|Failed to fetch|model topology/i.test(err.message)) {
    return false;
  }
});

// window:before:load 안에서 fetch stub 강화
Cypress.on('window:before:load', (win) => {
  const originalFetch = win.fetch.bind(win);
  const dummyModelJson = JSON.stringify({
    modelTopology: {},
    weightsManifest: [],
  });

  win.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('tfhub.dev/mediapipe')) {
      const res = new Response(dummyModelJson, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      return Promise.resolve(res);
    }

    if (url.includes('webgazer')) {
      const res = new Response('{"ok":true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      return Promise.resolve(res);
    }

    return originalFetch(input, init).catch(() =>
      Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })),
    );
  };

  // Mock WebGazer surface so components can call into it safely.
  Object.defineProperty(win, 'webgazer', {
    writable: true,
    value: buildWebgazerMock(),
  });

  // Common browser API shims
  if (!('ResizeObserver' in win)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    win.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!('matchMedia' in win)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    win.matchMedia = () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; },
    });
  }
});
