# SyncGaze Backend (Node.js)

A lightweight Express server that exposes the Firebase-admin powered endpoints for CSV uploads and survey submissions.

## Setup
1. Install dependencies
   ```bash
   cd backend
   npm install
   ```
2. Provide Firebase admin credentials and the target Storage bucket via environment variables:
   - `FIREBASE_STORAGE_BUCKET`
   - Either `FIREBASE_SERVICE_ACCOUNT_JSON` **or** the trio `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (use `\n` escapes for newlines)
   - Optionally `GOOGLE_APPLICATION_CREDENTIALS` for application default credentials

## Running locally
```
npm start
```
The server listens on `PORT` (default `4000`) and exposes:
- `POST /api/upload-csv` – accepts a CSV body, stores it in Storage, and records metadata in Firestore. Requires `x-session-id` header.
- `POST /api/submit-survey` – stores survey responses under `sessions/{sessionId}` or `users/{uid}`.

## Connecting from the frontend
Set `VITE_API_BASE_URL` (or `VITE_BACKEND_URL`) in the frontend `.env` to point to this server, e.g. `http://localhost:4000`.