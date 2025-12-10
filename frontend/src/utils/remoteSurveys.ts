import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SurveyResponses } from '../state/trackingSessionContext';

export const fetchLatestSurveyForUser = async (uid: string): Promise<SurveyResponses | null> => {
  const surveysRef = collection(db, 'users', uid, 'surveys');

  let snapshot;

  try {
    snapshot = await getDocs(query(surveysRef, orderBy('createdAt', 'desc'), limit(1)));
  } catch (error) {
    snapshot = await getDocs(surveysRef);
  }

  if (snapshot.empty) {
    return null;
  }

  const docData = snapshot.docs[0]?.data() as SurveyResponses | undefined;
  return docData ?? null;
};
