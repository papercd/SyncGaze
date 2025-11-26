import cors from 'cors';
import express from 'express';
import { submitSurveyRoute } from './routes/submitSurvey.js';
import { uploadCsvRoute } from './routes/uploadCsv.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use('/api/upload-csv', express.text({ type: '*/*', limit: '10mb' }), uploadCsvRoute);
app.use('/api/submit-survey', express.json({ limit: '1mb' }), submitSurveyRoute);

app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

app.use((err, req, res, next) => { // eslint-disable-line @typescript-eslint/no-unused-vars
  console.error('Unexpected server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`SyncGaze backend listening on port ${port}`);
});