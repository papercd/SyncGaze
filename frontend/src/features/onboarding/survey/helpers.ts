import { SurveyResponses } from '../../../state/trackingSessionContext';
import { NONE_GAME_VALUE, OTHER_GAME_VALUE, SurveyGameOption, surveyGameOptions } from './constants';

type Translator = (key: string, fallback: string) => string;

export const validateSurveyResponses = (
  data: SurveyResponses,
  t: Translator,
): string | null => {
  if (!data.ageCheck || !data.webcamCheck) {
    return t('survey.validation.age', '만 18세 이상이며 웹캠이 있어야 참여 가능합니다.');
  }
  if (data.gamesPlayed.length === 0 || data.gamesPlayed.includes(NONE_GAME_VALUE)) {
    return t(
      'survey.validation.notEligible',
      '연구 대상(FPS 게임 경험자)이 아닙니다. 참여하실 수 없습니다.',
    );
  }
  if (!data.mainGame) {
    return t('survey.validation.mainGameMissing', '주력 게임을 선택해주세요.');
  }
  if (data.mainGame !== OTHER_GAME_VALUE && !data.gamesPlayed.includes(data.mainGame)) {
    return t(
      'survey.validation.mainGameMismatch',
      '선택한 주력 게임이 게임 경험 목록에 없습니다.',
    );
  }
  if (data.mainGame === OTHER_GAME_VALUE && !data.mainGameOther.trim()) {
    return t('survey.validation.otherRequired', '주력 게임을 직접 입력해주세요.');
  }
  if (!data.aimTrainerUsage) {
    return t('survey.validation.aimTrainer', 'Aim Trainer 사용 여부를 선택해주세요.');
  }
  if (!data.inGameRank.trim()) {
    return t('survey.validation.rank', '현재 인게임 랭크를 입력해주세요.');
  }
  return null;
};

const rankHints: Partial<Record<string, string>> = {
  valorant: 'survey.rankExamples.valorant',
  cs2: 'survey.rankExamples.cs2',
  'apex-legends': 'survey.rankExamples.apex-legends',
  'rainbow-six-siege': 'survey.rankExamples.rainbow-six-siege',
  pubg: 'survey.rankExamples.pubg',
  warzone: 'survey.rankExamples.warzone',
  'escape-from-tarkov': 'survey.rankExamples.escape-from-tarkov',
  'hunt-showdown': 'survey.rankExamples.hunt-showdown',
  'overwatch-2': 'survey.rankExamples.overwatch-2',
};

export const findGameOption = (value: string): SurveyGameOption | undefined =>
  surveyGameOptions.find(option => option.value === value);

export const getRankExamples = (mainGame: string, t: Translator): string | null => {
  if (!mainGame) {
    return null;
  }
  const key = rankHints[mainGame];
  if (key) {
    return t(key, key);
  }
  return t('survey.rankExamples.default', '(예: 가능한 한 정확한 티어/랭크 표기를 입력)');
};