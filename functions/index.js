// functions/index.js
import * as functions from "firebase-functions";
import express from "express";
import cors from "cors";

// 중요: 경로에 '/src'가 포함되어야 하며, .js 확장자를 명시해야 합니다.
import { submitSurveyRoute } from "./src/routes/submitSurvey.js";
import { uploadCsvRoute } from "./src/routes/uploadCsv.js";

// dotenv는 functions 설정에서는 보통 process.env로 자동 주입되거나
// firebase functions:config:set을 사용하므로 여기서는 생략 가능하나, 
// 로컬 테스트를 위해 남겨둘 경우:
import dotenv from 'dotenv';
dotenv.config();

const app = express();

// CORS 설정
app.use(cors({ origin: true }));

// 라우트 설정
// 기존 backend/src/server.js의 설정을 그대로 가져옵니다.
app.use('/api/upload-csv', express.text({ type: '*/*', limit: '1mb' }), uploadCsvRoute);
app.use('/api/submit-survey', express.json({ limit: '1mb' }), submitSurveyRoute);

app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

app.use((err, req, res, next) => { // eslint-disable-line @typescript-eslint/no-unused-vars
  console.error('Unexpected server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Firebase Cloud Function으로 내보내기
export const api = functions.https.onRequest(app);