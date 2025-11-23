// functions/src/firebaseAdmin.js
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

export const ensureFirebaseInitialized = () => {
  if (admin.apps.length) {
    return admin.app();
  }

  const storageBucket = process.env.SYNCGAZE_STORAGE_BUCKET;

  // initializeApp에 아무 인자도 넘기지 않거나, credential 없이 설정하면
  // Firebase Functions 환경의 기본 권한(Application Default Credentials)을 자동으로 사용합니다.
  if (storageBucket) {
    return admin.initializeApp({
      storageBucket: storageBucket,
    });
  }

  return admin.initializeApp();
};

// 나머지 헬퍼 함수들은 그대로 유지하거나 필요시 수정
export const verifyIdTokenIfPresent = async (authorizationHeader) => {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorizationHeader.replace('Bearer ', '');
  const app = ensureFirebaseInitialized();
  return admin.auth(app).verifyIdToken(token);
};

export const getFirebaseAdmin = () => {
  const app = ensureFirebaseInitialized();
  
  return {
    app,
    admin,
    bucket: admin.storage(app).bucket(),
    db: admin.firestore(app),
  };
};