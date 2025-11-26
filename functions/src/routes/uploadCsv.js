import { getFirebaseAdmin, verifyIdTokenIfPresent } from '../firebaseAdmin.js';

const streamToString = async stream => {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
    stream.on('error', err => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
};

const extractCsvPayload = async req => {
  if (typeof req.body === 'string') {
    return req.body;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body.toString('utf8');
  }

  return streamToString(req);
};

export const uploadCsvRoute = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const sessionId = req.headers['x-session-id'] || req.query?.sessionId;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ message: 'Missing sessionId header or query parameter.' });
  }

  let csvData;
  try {
    csvData = await extractCsvPayload(req);
  } catch (error) {
    console.error('Failed to read CSV payload:', error);
    return res.status(400).json({ message: 'Unable to read CSV payload.' });
  }

  if (!csvData || csvData.length === 0) {
    return res.status(400).json({ message: 'No CSV data received.' });
  }

  let adminHelpers;
  try {
    adminHelpers = getFirebaseAdmin();
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    return res.status(503).json({
      message:
        'Firebase is not configured for uploads. Set FIREBASE_STORAGE_BUCKET and service account credentials to enable CSV export.',
    });
  }

  try {
    await verifyIdTokenIfPresent(req.headers.authorization);
  } catch (error) {
    console.error('Invalid Firebase ID token:', error);
    return res.status(401).json({ message: 'Unauthorized Firebase token.' });
  }

  try {
    const { admin, bucket, db } = adminHelpers;

    const filename = `gaze-results-${Date.now()}.csv`;
    const storagePath = `sessions/${sessionId}/${filename}`;
    const file = bucket.file(storagePath);

    await file.save(csvData, {
      metadata: { contentType: 'text/csv;charset=utf-8;' },
      resumable: false,
    });

    const [downloadUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    await db
      .collection('sessions')
      .doc(sessionId)
      .set(
        {
          exportPath: storagePath,
          exportDownloadUrl: downloadUrl,
          exportUploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return res.status(200).json({
      message: 'Upload successful',
      storagePath,
      downloadUrl,
      sessionId,
    });
  } catch (error) {
    console.error('Error uploading CSV to Firebase:', error);
    return res.status(500).json({
      message: 'Error uploading CSV to Firebase Storage.',
      error: error.message,
    });
  }
};