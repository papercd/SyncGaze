import { useEffect, useRef } from 'react';
import { useAuth } from '../state/authContext';
import { useTrackingSession } from '../state/trackingSessionContext';
import { fetchSessionsForUser } from '../utils/remoteSessions';
import { fetchLatestSurveyForUser } from '../utils/remoteSurveys';
import { defaultSurveyResponses } from '../features/onboarding/survey';

const SessionRemoteHydrator = () => {
  const { user } = useAuth();
  const {
    hydrateSessions,
    setSurveyResponses,
    setConsentAccepted,
    saveCalibrationResult,
    surveyResponses,
    consentAccepted,
    calibrationResult,
    setSurveyHydrated,
    surveyHydrated,
  } = useTrackingSession();

  const isFetchingRef = useRef(false);
  const hydratedUidRef = useRef<string | null>(null);

  useEffect(() => {
    const uid = user?.uid ?? null;

    if (!uid) {
      hydratedUidRef.current = null;
       if (surveyHydrated) {
        setSurveyHydrated(false);
      }
      return;
    }

    if (isFetchingRef.current || hydratedUidRef.current === uid) {
      return;
    }

    isFetchingRef.current = true;

    const hydrate = async () => {
      try {
        const [records, latestSurvey] = await Promise.all([
          fetchSessionsForUser(uid),
          fetchLatestSurveyForUser(uid),
        ]);

        if (records.length) {
          hydrateSessions(records.map(record => record.session));

          const latestWithSurvey = records.find(record => record.surveyResponses);
          if (!surveyResponses && latestWithSurvey?.surveyResponses) {
            setSurveyResponses({ ...defaultSurveyResponses, ...latestWithSurvey.surveyResponses });
          }

          const latestConsent = records.find(record => record.consentAccepted);
          if (!consentAccepted && latestConsent?.consentAccepted) {
            setConsentAccepted(true);
          }

          const latestCalibration = records.find(record => record.calibrationResult);
          if (!calibrationResult && latestCalibration?.calibrationResult) {
            saveCalibrationResult(latestCalibration.calibrationResult);
          }
        }

        if (!surveyResponses && latestSurvey) {
          setSurveyResponses({ ...defaultSurveyResponses, ...latestSurvey });
        }
      } catch (error) {
        console.warn('Failed to hydrate sessions from Firestore', error);
      } finally {
        hydratedUidRef.current = uid;
        isFetchingRef.current = false;
        setSurveyHydrated(true);
      }
    };

    hydrate();
  }, [
    user?.uid,
    hydrateSessions,
    surveyResponses,
    setSurveyResponses,
    consentAccepted,
    setConsentAccepted,
    calibrationResult,
    saveCalibrationResult,
    setSurveyHydrated,
    surveyHydrated,
  ]);

  return null;
};

export default SessionRemoteHydrator;
