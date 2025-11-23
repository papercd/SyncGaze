# SyncGaze Tracking Workspace

This repository hosts two related React applications:

- `frontend/` – the Vite-powered demo that stitches together onboarding, consent, calibration, training and analytics flows that share a single `trackingSessionContext`.
- `tracker-app/` – the original CRA prototype (kept for reference) that provided the first iteration of the tracker UI.

## In-game overview
<img width="1685" height="948" alt="KakaoTalk_Photo_2025-11-23-18-19-09 001" src="https://github.com/user-attachments/assets/6d86c1f0-3e2b-4e54-be9a-1b6f0510a29b" />
<img width="1710" height="984" alt="KakaoTalk_Photo_2025-11-23-18-19-09 003" src="https://github.com/user-attachments/assets/5fee9ebe-0a48-4b37-ae0f-99d234445fd9" />
<img width="1279" height="738" alt="KakaoTalk_Photo_2025-11-23-18-19-10 004" src="https://github.com/user-attachments/assets/1457733b-67bf-4482-a0fe-9c2745736ce9" />
<img width="1710" height="981" alt="KakaoTalk_Photo_2025-11-23-18-19-10 005" src="https://github.com/user-attachments/assets/cc6e7c37-c57b-43b7-a1e7-486c5e3a07e9" />
<img width="1710" height="985" alt="KakaoTalk_Photo_2025-11-23-18-19-10 006" src="https://github.com/user-attachments/assets/a80805a6-9032-4a8d-9496-c3d52e265b10" />


## Frontend overview

The new `frontend` app exposes every research step as a dedicated page while keeping shared state in `src/state/trackingSessionContext.tsx`. Feature-specific code now lives under `src/features`:

- `features/onboarding/survey` centralises survey defaults, storage helpers, API calls and reusable UI such as the eligibility checklist and game selector.
- `features/tracker/calibration` contains calibration constants, types and 2D overlay components used by the calibration page and the `useWebgazer` hook.

### Local development

```bash
cd frontend
npm install            # install/update dependencies
npm run dev            # start Vite dev server
npm run build          # type-check and create a production bundle
npm run preview        # preview the production build
```
Copy `frontend/.env.example` to `frontend/.env` and populate it with your Firebase project keys before starting Vite. When you
change any `VITE_FIREBASE_*` value make sure to restart the dev server so that the updated environment variables are injected
into the client bundle.

### Testing workflow

Unit tests rely on Vitest + React Testing Library and live alongside the pages they exercise, while end-to-end coverage is provided by Cypress.

```bash
npm run test           # run the Vitest suite once
npm run test:watch     # watch mode for rapid UI iteration
npm run test:e2e       # execute Cypress specs in headless mode
npm run test:e2e:open  # launch the Cypress runner UI
```

> **Note:** When running inside restricted environments you may need to configure npm/yarn to use an allow-listed registry or install the dev dependencies from an internal mirror before running the commands above.

## QA checklist

The following manual checklist keeps regressions away from critical study flows:

- [ ] **Webcam permission gate** – the calibration page (`/calibration`) must request camera access before transitioning away from the idle instructions, and gracefully handle rejected permissions.
- [ ] **Recalibration loop** – when `Validation` reports an error greater than `RECALIBRATION_THRESHOLD`, clicking “Recalibrate” should reset validation stats, clear gaze data and relaunch the dot sequence.
- [ ] **Survey gating** – age/webcam toggles and the “해당 없음” option in the screening survey should block submission and display the validation banner until all conditions are satisfied.
- [ ] **Consent synchronisation** – toggling the consent checkbox in `/tracker-app` must immediately update the consent step inside `/tracker-flow` and persist after a reload.
- [ ] **Session context persistence** – completing (or skipping) calibration, training or results should update `trackingSessionState` in `localStorage` so that `/tracker-flow` reflects real progress after reloading the page or switching tabs.
- [ ] **CSV export & upload** – from `/results`, trigger “Download CSV” and the optional upload flag to confirm `exportSessionData` attaches survey + consent metadata and handles upload failures with the toast messaging.
- [ ] **Webcam re-alignment** – verify the calibration task overlay properly follows the cursor and that the task phase advances when all dots are clicked.
- [ ] **Cypress journey** – run the `trackerFlow.cy.ts` spec to cover the full survey → consent → tracker → training → results flow using the shared session context.

## Tracker flow scenario

The Cypress spec (`frontend/cypress/e2e/trackerFlow.cy.ts`) automates the critical happy path:

1. Complete the screening survey and land on `/tracker-flow`.
2. Jump into `/tracker-app`, accept consent and return to the tracker overview.
3. Patch the calibration summary (mirroring the skip/test button) and start a training session to ensure the HUD renders.
4. Inject a mock training session so that `/results` can be opened without waiting for live data, then verify the analytics cards.

Keeping this script green alongside the Vitest coverage ensures that onboarding, consent, calibration, training and reporting remain wired together as a single experience.
