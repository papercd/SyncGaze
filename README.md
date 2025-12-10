# SyncGaze Tracking Workspace

SyncGaze is a multi-language eye-tracking training and analytics stack. The Vite + React frontend drives onboarding → calibration → training → results → AI reports, while the Node backend handles CSV uploads, survey storage, and Anthropic-powered reports. Optional Python services cover ML score prediction and Cloud Run ingestion.

## Repository layout
- `frontend/` – main Vite app (React + TypeScript) with WebGazer tracking, dashboard/results/report pages, bilingual UI (ko/en), Firebase Auth, and session persistence.
- `backend/` – Express API backed by firebase-admin for CSV uploads, survey writes, and Claude-based performance reports.
- `cloudrun/` – Python Cloud Run service that ingests Storage CSVs and writes joined summaries to Firestore/BigQuery.
- `ml_inference_function/` – Python HTTP function that returns `predictedScore` for a session; wire it via `VITE_PREDICTION_ENDPOINT`.
- `analysis/` – offline scripts/notebooks for feature extraction and model training.
- `tracker-app/` – original CRA prototype kept for reference only.
- `functions/` – firebase-functions friendly copy of the backend routes (use `backend/` for local/dev).

### Project map
```
SyncGaze/
├─ frontend/                 # Vite app (React + TS)
│  ├─ src/
│  │  ├─ pages/              # Landing, Auth, Dashboard, Calibration, Training, Results, Report, etc.
│  │  ├─ features/
│  │  │  ├─ onboarding/      # Survey, consent helpers & UI
│  │  │  └─ tracker/         # Calibration components, constants, types
│  │  ├─ state/              # Contexts: trackingSession, auth, language, settings
│  │  ├─ hooks/              # Webgazer + tracking utilities
│  │  ├─ services/           # API helpers (reports, predictions)
│  │  ├─ utils/              # analytics, exports, remote session storage
│  │  └─ __tests__/          # Unit/UI specs (Vitest + RTL)
│  ├─ cypress/               # E2E specs (trackerFlow, errorHandling)
│  └─ public/                # static assets
├─ backend/                  # Express API (upload CSV, survey, report proxy)
│  └─ src/routes/            # uploadCsv, submitSurvey, generateReport
├─ cloudrun/                 # Python CSV ingestor for Firestore/BigQuery
├─ ml_inference_function/    # Python HTTP function for predictedScore
├─ analysis/                 # Data prep/model training scripts
└─ tracker-app/              # Legacy CRA prototype
```

## Frontend (Vite)
Prereq: Node 18+.
1. `cd frontend && npm install`
2. Copy `.env.example` to `.env` and fill:
   - `VITE_FIREBASE_*` – Firebase client keys (required)
   - `VITE_API_BASE_URL` or `VITE_BACKEND_URL` – URL of the Node backend for CSV upload/report generation
   - `VITE_PREDICTION_ENDPOINT` or `VITE_PERFORMANCE_MODEL_ENDPOINT` – optional ML scoring endpoint (falls back to heuristic when absent)
3. Run `npm run dev` to start Vite, `npm run build` for production, `npm run preview` to serve the bundle.
4. Tests: `npm run test`, `npm run test:watch`, `npm run test:e2e`, `npm run test:e2e:open` (Vitest + Cypress, see `frontend/cypress/e2e`).

### Product flow highlights
- Auth + onboarding: email/password, Google, or anonymous sign-in (`AuthPage`), bilingual copy via `LanguageProvider`, survey + consent steps gate access and sync to Firestore with `saveSurveyAndConsent`.
- Calibration + training: WebGazer-backed calibration (`CalibrationPage`) with webcam gating, validation, and `RECALIBRATION_THRESHOLD` enforcement; `TrainingPage` records gaze/mouse/target telemetry.
- Results + storage: `ResultsPage` computes analytics (`calculatePerformanceAnalytics`), exports CSV via `exportSessionData`, optionally uploads to the backend/Storage, and persists sessions to Firestore with `saveSessionForUser` (including leaderboard opt-in and predicted score).
- Insights: dashboard, history, and leaderboard pages read from Firestore (`SessionRemoteHydrator` hydrates on login). `ReportPage` calls the backend to generate Anthropic-based coaching reports; `predictionService` uses the ML endpoint when configured and otherwise falls back to a deterministic score.

### Testing
- Unit/UI: Vitest + React Testing Library; tests colocated under `frontend/src/**/__tests__` and page-level specs. Run `npm run test` or `npm run test:watch`.
- E2E: Cypress specs in `frontend/cypress/e2e` (`trackerFlow.cy.ts`, `errorHandling.cy.ts`). Run `npm run test:e2e` (headless) or `npm run test:e2e:open`.
- Mocking/fixtures: rely on RTL queries for DOM; Cypress uses Vite dev server config from `cypress.config.cjs`.

## Backend (Express API)
Prereq: Node 18+.
1. `cd backend && npm install`
2. Configure environment:
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` (use `\n` for newlines) or `GOOGLE_APPLICATION_CREDENTIALS`
   - `ANTHROPIC_API_KEY` for report generation
   - `PORT` (optional, default `4000`)
3. `npm start` to launch the API.

Endpoints:
- `POST /api/upload-csv` – expects CSV body + `x-session-id`; uploads to Storage and records metadata in Firestore (and user-scoped copy when authenticated).
- `POST /api/submit-survey` – stores survey payloads under `sessions/{sessionId}/surveys` or `users/{uid}/surveys`.
- `POST /api/generate-report` – proxies prompts to Anthropic Claude and returns the generated report.

## Optional services
- `ml_inference_function/`: deployable Python HTTP function for performance scoring; set its URL in `VITE_PREDICTION_ENDPOINT`.
- `cloudrun/`: Cloud Run CSV ingestor wiring Storage events to Firestore/BigQuery (see `cloudrun/README.md`).
- `analysis/`: local data prep and model training assets.
- `tracker-app/`: legacy CRA UI; kept for context, not wired into the current Vite app.

## User flow (current Vite app)
1) Landing → user chooses Sign up / Sign in / Explore: language toggle persists choice.
2) Auth (`/auth`): email/password, Google, or anonymous login. On success, `TrackingSessionProvider` marks anonymous vs. identified sessions and redirects to `/dashboard`.
3) Onboarding survey/consent (`/onboarding/...`): required unless anonymous; data saved to Firestore via `saveSurveyAndConsent` and used to gate protected routes.
4) Calibration (`/calibration`): webcam permission + WebGazer session; validation enforces `RECALIBRATION_THRESHOLD`; exiting stops tracking, continuing routes to training.
5) Training (`/training`): collects gaze/mouse/target telemetry for the session.
6) Results (`/results`): computes analytics, exports CSV locally, optional upload to backend/Storage with `x-session-id`, and saves session + calibration + survey metadata to Firestore (and leaderboard if opted-in).
7) Report (`/report`): generates AI coaching report via backend Anthropic proxy; predicted score fetched from ML endpoint or fallback heuristic.
8) History/Leaderboard (`/sessions`, `/leaderboard`): renders stored sessions and optional leaderboard entries; hydration occurs after auth.

## Manual QA reminders
- Auth: email/Google/anonymous flows land on `/dashboard` and respect persisted language settings.
- Onboarding: survey + consent gates block tracker pages until completed; state survives reload via localStorage/Firestore hydration.
- Calibration: webcam permission gating, validation respects `RECALIBRATION_THRESHOLD`, and exiting stops WebGazer; proceeding routes into training.
- Training → Results: telemetry is captured, analytics render (reaction times, gaze/mouse accuracy, sync), and CSV export/upload succeeds with `x-session-id` metadata stored in Firestore/Storage.
- Reports + predictions: `ReportPage` surfaces Anthropic errors when the API key is missing, and score prediction falls back gracefully when the ML endpoint is absent.
- Leaderboard/history: sessions and leaderboard entries write to Firestore and re-hydrate on dashboard/leaderboard/sessions pages; consent and calibration status persist across tabs.
- Localization: ko/en toggle persists and updates UI copy across landing, dashboard, tracker, and report flows.
