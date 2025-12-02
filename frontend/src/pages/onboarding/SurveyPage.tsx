import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

      navigate('/onboarding/consent');
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
      navigate('/onboarding/consent');
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
          <p className="eyebrow">Onboarding</p>
          <h1>{t('survey.header.title', '연구 참여 스크리닝 설문')}</h1>
          <p>{t('survey.header.description', '기본 자격을 확인하고 tracker-flow 컨텍스트에 설문 결과를 동기화합니다.')}</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => navigate('/tracker-flow')}>
          {t('survey.header.progress', '진행 현황 보기')}
        </button>
      </header>

      <main className="survey-shell">
        <section className="survey-card">
          <div className="survey-card__header">
            <div>
              <h2>{t('survey.section.participant', '참여자 정보')}</h2>
              <p>{t('survey.section.participant.desc', 'FPS 게임 경험과 장비 보유 여부를 확인합니다.')}</p>
            </div>
            <span className={`status-pill ${isReadyToSubmit ? 'success' : 'pending'}`}>
              {isReadyToSubmit
                ? t('survey.status.ready', '제출 준비 완료')
                : t('survey.status.pending', '입력 필요')}
            </span>
          </div>

          <form className="survey-form" onSubmit={handleSubmit}>
            <fieldset>
              <legend>{t('survey.legend.eligibility', '기본 자격')}</legend>
              <EligibilityChecklist
                values={{ ageCheck: formData.ageCheck, webcamCheck: formData.webcamCheck }}
                onToggle={handleEligibilityToggle}
                labelOverrides={{
                  ageCheck: t(
                    'survey.eligibility.age',
                    'Q1. 귀하는 만 18세 이상이며, 본 연구의 목적을 이해하고 자발적으로 참여하는 데 동의하십니까?',
                  ),
                  webcamCheck: t(
                    'survey.eligibility.webcam',
                    'Q2. 본 연구에 참여하기 위한 PC/노트북에 작동하는 웹캠이 설치되어 있습니까?',
                  ),
                }}
              />
            </fieldset>

            <fieldset>
              <legend>{t('survey.legend.gameplay', '게임 경험')}</legend>
              <p className="question-title">
                {t('survey.q3.title', 'Q3. 지난 6개월간 다음 FPS 게임 중 하나 이상을 주 5시간 이상 정기적으로 플레이했습니까?')}
                <br />
                <span className="hint-text">{t('survey.q3.hint', '주요 장르별 분류, 중복 선택 가능')}</span>
              </p>
              <GamePreferenceSelector
                options={surveyGameOptions}
                selectedGames={formData.gamesPlayed}
                onToggle={handleGameToggle}
              />
              <p className="hint-text">{t('survey.q3.note', '* "위 목록에 없음" 선택 시 주력 FPS를 직접 기입해주세요.')}</p>
            </fieldset>

            <fieldset>
              <legend>{t('survey.legend.mainGame', '주력 게임')}</legend>
              <p className="question-title">
                {t(
                  'survey.q4.title',
                  'Q4. (질문 3에서 선택한 게임 중) 귀하의 "주력 게임"(가장 자신 있거나 시간을 많이 투자한 게임)은 무엇입니까?',
                )}
              </p>
              <label className="form-field" htmlFor="mainGame">
                <span>{t('survey.q4.dropdownLabel', '드롭다운 메뉴: 질문 3에서 선택한 모든 게임')}</span>
                <select
                  id="mainGame"
                  name="mainGame"
                  value={formData.mainGame}
                  onChange={handleGeneralChange}
                  disabled={isNoneSelected || selectedGameOptions.length === 0}
                >
                  <option value="">{t('survey.q4.placeholder', '주력 게임을 선택하세요')}</option>
                  {selectedGameOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {formData.mainGame === OTHER_GAME_VALUE && (
                <label className="form-field" htmlFor="mainGameOther">
                  <span>{t('survey.q4.otherLabel', '위 목록에 없음: 플레이하는 주력 FPS를 입력해주세요.')}</span>
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
                    "Q5. 지난 6개월간 Aim Trainer(예: KovaaK's, Aim Lab)를 정기적으로 사용했습니까?",
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
                <p className="hint-text">{t('survey.q5.hint', 'Aim Trainer 사용 여부는 스킬 분석의 중요한 변수가 될 수 있습니다.')}</p>
              </div>
            </fieldset>

            <fieldset>
              <legend>{t('survey.legend.rank', '객관적 실력 지표')}</legend>
              {formData.mainGame ? (
                <label className="form-field">
                  <span>
                    {t('survey.q6.label', 'Q6. ({mainGame}) 현재 인게임 랭크는 무엇입니까?').replace(
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
                    placeholder={t('survey.q6.placeholder', '현재 랭크를 정확히 입력하세요')}
                  />
                </label>
              ) : (
                <p className="hint-text">{t('survey.q6.wait', 'Q6. (질문 4에서 주력 게임을 선택하세요)')}</p>
              )}
            </fieldset>

            <fieldset>
              <legend>{t('survey.legend.experience', '경험치와 자기 평가')}</legend>
              <label className="form-field" htmlFor="playTime">
                <span>
                  {t(
                    'survey.q7.label',
                    'Q7. (질문 4에서 선택한) 귀하의 총 플레이 시간은 대략 어느 정도입니까? (Riot/Steam 계정에서 확인 가능)',
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
                    'Q8. 다른 플레이어들과 비교하여, 귀하 스스로의 전반적인 FPS 게임 실력을 어떻게 평가하십니까?',
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
                  : t('survey.submit', '설문 제출 및 다음 단계로')}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

export default SurveyPage;