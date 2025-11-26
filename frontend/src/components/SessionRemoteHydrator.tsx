import { useEffect, useRef } from 'react';
import { useAuth } from '../state/authContext';
import { useTrackingSession } from '../state/trackingSessionContext';
import { fetchSessionsForUser } from '../utils/remoteSessions';

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
  } = useTrackingSession();

  const isFetchingRef = useRef(false);
  const hydratedUidRef = useRef<string | null>(null);

  useEffect(() => {
    const uid = user?.uid ?? null;

    if (!uid) {
      hydratedUidRef.current = null;
      return;
    }

    if (isFetchingRef.current || hydratedUidRef.current === uid) {
      return;
    }

    isFetchingRef.current = true;

    fetchSessionsForUser(uid)
      .then(records => {
        if (records.length) {
          hydrateSessions(records.map(record => record.session));

          const latestWithSurvey = records.find(record => record.surveyResponses);
          if (!surveyResponses && latestWithSurvey?.surveyResponses) {
            setSurveyResponses(latestWithSurvey.surveyResponses);
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
      })
      .catch(error => {
        console.warn('Failed to hydrate sessions from Firestore', error);
      })
      .finally(() => {
        hydratedUidRef.current = uid;
        isFetchingRef.current = false;
      });
  }, [user?.uid, hydrateSessions, surveyResponses, setSurveyResponses, consentAccepted, setConsentAccepted, calibrationResult, saveCalibrationResult]);

  return null;
};

export default SessionRemoteHydrator;