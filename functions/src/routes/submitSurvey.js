import { getFirebaseAdmin, verifyIdTokenIfPresent } from '../firebaseAdmin.js';

const parseBody = async req => {
  if (typeof req.body === 'object' && req.body !== null) {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : null;
};

export const submitSurveyRoute = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  let payload;
  try {
    payload = await parseBody(req);
  } catch (error) {
    console.error('Failed to parse survey payload:', error);
    return res.status(400).json({ message: 'Invalid survey payload' });
  }

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ message: 'Missing survey payload' });
  }

  const { sessionId, uid, ...surveyResponses } = payload;

  if (!sessionId && !uid) {
    return res.status(400).json({ message: 'Missing sessionId or uid for survey submission' });
  }

  try {
    await verifyIdTokenIfPresent(req.headers.authorization);
  } catch (error) {
    console.error('Invalid Firebase ID token:', error);
    return res.status(401).json({ message: 'Unauthorized Firebase token.' });
  }

  let admin;
  let db;
  try {
    ({ admin, db } = getFirebaseAdmin());
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    return res.status(503).json({
      message:
        'Firebase is not configured for survey submissions. Set FIREBASE_STORAGE_BUCKET and service account credentials to enable Firestore access.',
    });
  }

  try {
    const collectionPath = uid ? ['users', uid, 'surveys'] : ['sessions', sessionId, 'surveys'];
    const docRef = await db.collection(collectionPath.join('/')).add({
      ...surveyResponses,
      sessionId: sessionId || null,
      uid: uid || null,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: 'Survey submitted', id: docRef.id });
  } catch (error) {
    console.error('Error writing survey to Firestore:', error);
    return res.status(500).json({ message: 'Error saving survey responses.' });
  }
};