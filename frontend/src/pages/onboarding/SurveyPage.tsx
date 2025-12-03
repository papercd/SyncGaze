import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  useTrackingSession,
  SurveyResponses,
  saveSurveyAndConsent,
} from '../../state/trackingSessionContext';
import {
  EligibilityChecklist,
  GamePreferenceSelector,
  clearSurveyDraft,
  defaultSurveyResponses,
  getRankExamples,
  findGameOption,
  loadSurveyFromSession,
  NONE_GAME_VALUE,
  OTHER_GAME_VALUE,
  persistSurveyToSession,
  playTimeOptions,
  submitSurveyResponses,
  surveyGameOptions,
  validateSurveyResponses,
} from '../../features/onboarding/survey';
import { useAuth } from '../../state/authContext';
import { useTranslation } from '../../state/languageContext';
import './SurveyPage.css';

const SurveyPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const { surveyResponses, setSurveyResponses, activeSession } = useTrackingSession();
  const [formData, setFormData] = useState<SurveyResponses>(
    surveyResponses ?? loadSurveyFromSession() ?? defaultSurveyResponses,
  );
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!surveyResponses) {
      return;
    }
    setFormData(surveyResponses);
  }, [surveyResponses]);

  useEffect(() => {
    try {
      persistSurveyToSession(formData);
      setStorageError(null);
    } catch (storageErr) {
      setStorageError(storageErr instanceof Error ? storageErr.message : String(storageErr));
    }
  }, [formData]);

  const isReadyToSubmit = useMemo(
    () => !validateSurveyResponses(formData, t),
    [formData, t],
  );
  const selectedGameOptions = useMemo(
    () => surveyGameOptions.filter(option => formData.gamesPlayed.includes(option.value)),
    [formData.gamesPlayed],
  );
  const mainGameLabel = useMemo(() => {
    if (formData.mainGame === OTHER_GAME_VALUE) {
      return formData.mainGameOther || t('survey.q4.manualEntry', '직접 입력');
    }
    return findGameOption(formData.mainGame)?.label ?? formData.mainGame;
  }, [formData.mainGame, formData.mainGameOther, t]);
  const isNoneSelected = formData.gamesPlayed.includes(NONE_GAME_VALUE);
  const redirectTarget = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const handleEligibilityToggle = (field: 'ageCheck' | 'webcamCheck', checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked,
    }));
  };

  const handleGeneralChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormData(prev => {
      const nextValue = name === 'selfAssessment' ? Number(value) : value;
      const updated = {
        ...prev,
        [name]: nextValue,
      };

      if (name === 'mainGame' && value !== OTHER_GAME_VALUE) {
        return { ...updated, mainGameOther: '' };
      }

      return updated;
    });
  };

  const handleGameToggle = (game: string) => {
    setFormData(prev => {
      if (game === NONE_GAME_VALUE) {
        const alreadySelected = prev.gamesPlayed.includes(game);
        return {
          ...prev,
          gamesPlayed: alreadySelected ? [] : [game],
          mainGame: '',
          mainGameOther: '',
        };
      }

      const filteredGames = prev.gamesPlayed.filter(item => item !== NONE_GAME_VALUE);
      const exists = filteredGames.includes(game);
      const nextGames = exists
        ? filteredGames.filter(item => item !== game)
        : [...filteredGames, game];

      const mainGameStillValid =
        nextGames.includes(prev.mainGame) || prev.mainGame === OTHER_GAME_VALUE;
      const shouldClearOtherField = !nextGames.includes(OTHER_GAME_VALUE);
      return {
        ...prev,
        gamesPlayed: nextGames,
        mainGame: mainGameStillValid ? prev.mainGame : '',
        mainGameOther:
          mainGameStillValid && !shouldClearOtherField ? prev.mainGameOther : '',
      };
    });
  };

  const rankExamples = useMemo(
    () => getRankExamples(formData.mainGame, t),
    [formData.mainGame, t],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStorageError(null);
    setCloudError(null);

    const validationMessage = validateSurveyResponses(formData, t);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setIsSubmitting(true);

    try {
      const sessionId = activeSession?.id ?? null;
      const uid = user?.uid ?? null;

      let submissionFailed = false;
      try {
        await submitSurveyResponses(formData, { sessionId, uid });
      } catch (submissionError) {
        submissionFailed = true;
        console.warn('Survey submission failed, proceeding to next step:', submissionError);
      }

      setSurveyResponses(formData);

      if (user) {
        await saveSurveyAndConsent({ uid: user.uid, surveyResponses: formData });
        clearSurveyDraft();
      } else {
        throw new Error(
          t('survey.alert.notLoggedIn', '사용자 정보를 불러올 수 없습니다. 다시 로그인 후 시도해주세요.'),
        );
      }

      if (submissionFailed) {
        alert(t('survey.alert.demoMode', '백엔드 API 호출에 실패했지만 데모 모드로 다음 단계로 이동합니다.'));
      }

      navigate(redirectTarget, { replace: true });
    } catch (cloudSaveError) {
      console.error('Failed to persist survey to Firestore', cloudSaveError);
      setCloudError(t('survey.storage.error', '설문 응답을 클라우드에 저장하지 못했습니다. 네트워크 연결을 확인한 뒤 재시도해주세요.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryCloudSave = async () => {
    if (!user) {
      setCloudError(t('survey.storage.sessionMissing', '로그인 세션을 확인할 수 없습니다. 다시 로그인한 뒤 시도해주세요.'));
      return;
    }

    setIsSubmitting(true);
    try {
      await saveSurveyAndConsent({ uid: user.uid, surveyResponses: formData });
      clearSurveyDraft();
      setCloudError(null);
      navigate(redirectTarget, { replace: true });
    } catch (retryError) {
      console.error('Retrying survey save failed', retryError);
      setCloudError(
        t('survey.storage.retryFailed', '여전히 저장되지 않았습니다. 잠시 후 다시 시도하거나 지원팀에 문의해주세요.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="survey-page">
      <header className="survey-header">
        <div>
          <p className="eyebrow">Welcome</p>
          <h1>{t('survey.header.title', '처음 이용을 위한 실력 프로필')}</h1>
          <p>
            {t(
              'survey.header.description',
              '맞춤형 대시보드를 위해 현재 수준을 알려주세요. 설정에서 언제든 수정할 수 있습니다.',
            )}
          </p>
        </div>
      </header>

      <main className="survey-shell">
        <section className="survey-card">
          <div className="survey-card__header">
            <div>
              <h2>{t('survey.section.participant', '플레이어 프로필')}</h2>
              <p>
                {t(
                  'survey.section.participant.desc',
                  '현재 장비와 플레이 스타일을 간단히 입력하면 더 적합한 가이드와 목표를 제시해 드립니다.',
                )}
              </p>
            </div>
            <span className={`status-pill ${isReadyToSubmit ? 'success' : 'pending'}`}>
              {isReadyToSubmit
                ? t('survey.status.ready', '제출 준비 완료')
                : t('survey.status.pending', '입력 필요')}
            </span>
          </div>

          <form className="survey-form" onSubmit={handleSubmit}>
            <fieldset>
              <legend>{t('survey.legend.eligibility', '시작 준비도')}</legend>
              <EligibilityChecklist
                values={{ ageCheck: formData.ageCheck, webcamCheck: formData.webcamCheck }}
                onToggle={handleEligibilityToggle}
                labelOverrides={{
                  ageCheck: t(
                    'survey.eligibility.age',
                    '기본 PC/네트워크 환경이 준비되어 있습니다.',
                  ),
                  webcamCheck: t(
                    'survey.eligibility.webcam',
                    '시선 추적용으로 사용할 수 있는 웹캠/카메라가 있습니다.',
                  ),
                }}
              />
            </fieldset>

            <fieldset>
              <legend>{t('survey.legend.gameplay', '게임 경험')}</legend>
              <p className="question-title">
                {t('survey.q3.title', '어떤 FPS를 주로 플레이하시나요? (중복 선택 가능)')}
                <br />
                <span className="hint-text">{t('survey.q3.hint', '주로 즐기거나 연습해 보고 싶은 타이틀을 선택하세요.')}</span>
              </p>
              <GamePreferenceSelector
                options={surveyGameOptions}
                selectedGames={formData.gamesPlayed}
                onToggle={handleGameToggle}
              />
              <p className="hint-text">{t('survey.q3.note', '* "위 목록에 없음"을 선택하면 직접 입력할 수 있어요.')}</p>
            </fieldset>

            <fieldset>
              <legend>{t('survey.legend.mainGame', '집중 게임')}</legend>
              <p className="question-title">
                {t(
                  'survey.q4.title',
                  '방금 고른 게임 중 지금 가장 집중하고 싶은 게임은 무엇인가요?',
                )}
              </p>
              <label className="form-field" htmlFor="mainGame">
                <span>{t('survey.q4.dropdownLabel', '드롭다운: 방금 선택한 게임 목록')}</span>
                <select
                  id="mainGame"
                  name="mainGame"
                  value={formData.mainGame}
                  onChange={handleGeneralChange}
                  disabled={isNoneSelected || selectedGameOptions.length === 0}
                >
                  <option value="">{t('survey.q4.placeholder', '집중할 게임을 고르세요')}</option>
                  {selectedGameOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {formData.mainGame === OTHER_GAME_VALUE && (
                <label className="form-field" htmlFor="mainGameOther">
                  <span>{t('survey.q4.otherLabel', '위 목록에 없음: 집중할 게임을 직접 입력하세요.')}</span>
                  <input
                    id="mainGameOther"
                    name="mainGameOther"
                    value={formData.mainGameOther}
                    onChange={handleGeneralChange}
                    placeholder={t('survey.q4.otherPlaceholder', '예: Escape from Tarkov Arena')}
                  />
                </label>
              )}
              <div className="form-field">
                <span className="question-title">
                  {t(
                    'survey.q5.title',
                    '에임 트레이너나 연습 모드를 얼마나 활용하고 있나요?',
                  )}
                </span>
                <div className="radio-grid">
                  <label className="radio-chip">
                    <input
                      type="radio"
                      name="aimTrainerUsage"
                      value="yes"
                      checked={formData.aimTrainerUsage === 'yes'}
                      onChange={handleGeneralChange}
                    />
                    <span>{t('survey.q5.yes', '예')}</span>
                  </label>
                  <label className="radio-chip">
                    <input
                      type="radio"
                      name="aimTrainerUsage"
                      value="no"
                      checked={formData.aimTrainerUsage === 'no'}
                      onChange={handleGeneralChange}
                    />
                    <span>{t('survey.q5.no', '아니오')}</span>
                  </label>
                </div>
                <p className="hint-text">{t('survey.q5.hint', '연습 도구 사용 여부에 따라 추천 루틴을 다르게 제안합니다.')}</p>
              </div>
            </fieldset>

            <fieldset>
              <legend>{t('survey.legend.rank', '현재 수준')}</legend>
              {formData.mainGame ? (
                <label className="form-field">
                  <span>
                    {t('survey.q6.label', '({mainGame})에서 현재 티어/점수는 무엇인가요?').replace(
                      '{mainGame}',
                      mainGameLabel,
                    )}{' '}
                    {rankExamples && <span className="hint-text">{rankExamples}</span>}
                  </span>
                  <input
                    type="text"
                    id="inGameRank"
                    name="inGameRank"
                    value={formData.inGameRank}
                    onChange={handleGeneralChange}
                    placeholder={t('survey.q6.placeholder', '예: 실버 2, 플래티넘, 1800 MMR')}
                  />
                </label>
              ) : (
                <p className="hint-text">{t('survey.q6.wait', '집중할 게임을 먼저 선택해주세요.')}</p>
              )}
            </fieldset>

            <fieldset>
              <legend>{t('survey.legend.experience', '시간 & 목표')}</legend>
              <label className="form-field" htmlFor="playTime">
                <span>
                  {t(
                    'survey.q7.label',
                    '주당 얼마나 자주 플레이하나요?',
                  )}
                </span>
                <select id="playTime" name="playTime" value={formData.playTime} onChange={handleGeneralChange}>
                  {playTimeOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field" htmlFor="selfAssessment">
                <span>
                  {t(
                    'survey.q8.label',
                    '현재 에임/인게임 실력에 대한 자기 평가는 어느 정도인가요?',
                  )}
                </span>
                <div className="slider-row">
                  <span>(1)</span>
                  <input
                    id="selfAssessment"
                    name="selfAssessment"
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={formData.selfAssessment}
                    onChange={handleGeneralChange}
                  />
                  <span>(10)</span>
                  <strong>
                    {t('survey.q8.selected', '선택')}: {formData.selfAssessment}
                  </strong>
                </div>
              </label>
              <label className="form-field" htmlFor="trainingGoal">
                <span>
                  {t(
                    'survey.q9.goal',
                    '이번 시즌에 꼭 달성하고 싶은 목표나 개선 포인트를 알려주세요.',
                  )}
                </span>
                <textarea
                  id="trainingGoal"
                  name="trainingGoal"
                  rows={3}
                  value={formData.trainingGoal}
                  onChange={handleGeneralChange}
                  placeholder={t('survey.validation.goal', '예: 플래티넘 달성, 반응 속도 단축, 에임 안정화 등')}
                />
              </label>
            </fieldset>

            {(error || storageError) && (
              <div className="form-error" role="alert">
                {error ?? storageError}
              </div>
            )}

            {cloudError && (
              <div className="cloud-toast" role="alert">
                <div className="cloud-toast__message">{cloudError}</div>
                <div className="cloud-toast__actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleRetryCloudSave}
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? t('survey.cloud.retrying', '재시도 중...')
                      : t('survey.cloud.retry', '클라우드에 다시 저장')}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setCloudError(null)}
                    disabled={isSubmitting}
                  >
                    {t('survey.cloud.close', '닫기')}
                  </button>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="ghost-button" onClick={() => navigate(-1)}>
                {t('survey.back', '돌아가기')}
              </button>
              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting
                  ? t('survey.submitting', '제출 중...')
                  : t('survey.submit', '저장하고 계속하기')}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

export default SurveyPage;