import { SurveyResponses } from '../../../state/trackingSessionContext';

export interface SurveyGameOption {
  value: string;
  label: string;
  category: string;
  exclusive?: boolean;
  requiresDetail?: boolean;
}

export const OTHER_GAME_VALUE = 'other-main-game';
export const NONE_GAME_VALUE = 'none-selected';

export const SURVEY_SESSION_KEY = 'tracker.onboarding.surveyDraft';

export const defaultSurveyResponses: SurveyResponses = {
  ageCheck: false,
  webcamCheck: false,
  gamesPlayed: [],
  mainGame: '',
  mainGameOther: '',
  aimTrainerUsage: '',
  inGameRank: '',
  playTime: '주 3-7시간',
  selfAssessment: 4,
  trainingGoal: '',
};

export const surveyGameOptions: SurveyGameOption[] = [
  { category: '택티컬 슈터', value: 'valorant', label: '발로란트 (Valorant)' },
  { category: '택티컬 슈터', value: 'sudden-attack', label: '서든어택 (Sudden Attack)' },
  { category: '택티컬 슈터', value: 'cs2', label: '카운터-스트라이크 2 (CS2)' },
  { category: '택티컬 슈터', value: 'rainbow-six-siege', label: '레인보우 식스 시즈 (Rainbow Six Siege)' },
  { category: '배틀 로얄 / 하이-무브먼트', value: 'pubg', label: 'PUBG: 배틀그라운드 (PUBG: Battlegrounds)' },
  { category: '배틀 로얄 / 하이-무브먼트', value: 'apex-legends', label: 'Apex 레전드 (Apex Legends)' },
  { category: '배틀 로얄 / 하이-무브먼트', value: 'warzone', label: '콜 오브 듀티: 워존 (Call of Duty: Warzone)' },
  { category: '배틀 로얄 / 하이-무브먼트', value: 'the-finals', label: 'THE FINALS (더 파이널스)' },
  { category: '배틀 로얄 / 하이-무브먼트', value: 'fortnite', label: 'Fortnite (포트나이트 - 제로 빌드/FPS 모드)' },
  { category: '하드코어 / 익스트랙션', value: 'escape-from-tarkov', label: '이스케이프 프롬 타르코프 (Escape from Tarkov)' },
  { category: '하드코어 / 익스트랙션', value: 'hunt-showdown', label: 'Hunt: Showdown (헌트: 쇼다운)' },
  { category: '하드코어 / 익스트랙션', value: 'gray-zone-warfare', label: '그레이 존 워페어 (Gray Zone Warfare)' },
  { category: '기타 FPS', value: 'overwatch-2', label: '오버워치 2 (Overwatch 2)' },
  { category: '기타 FPS', value: 'battlefield', label: '배틀필드 (Battlefield) 시리즈' },
  { category: '기타 FPS', value: 'halo-infinite', label: 'Halo Infinite (헤일로 인피니트)' },
  { category: '기타 FPS', value: 'destiny-2', label: 'Destiny 2 (데스티니 가디언즈)' },
  { category: '기타 FPS', value: 'practice-only', label: '아직 주력 FPS가 없어요 (연습만 해볼게요)' },
  {
    category: '기타 FPS',
    value: OTHER_GAME_VALUE,
    label: '위 목록에 없음 (플레이하는 주력 FPS 기재)',
    requiresDetail: true,
  },
  { category: '기타 FPS', value: NONE_GAME_VALUE, label: '해당 없음 (선택 시 탈락)', exclusive: true },
];

export const playTimeOptions = ['주 1-3시간', '주 3-7시간', '주 7-14시간', '주 14-21시간', '주 21시간 이상'];
