# Leaderboard data plan

이 문서는 결과 페이지의 측정치를 기반으로 한 리더보드를 Firebase로 어떻게 구성할지 정리합니다. 현재 세션 데이터는 `users/{uid}/sessions/{sessionId}`에 저장되고, Firestore 규칙이 `request.auth.uid == userId`인 경우에만 접근을 허용하기 때문에 전체 사용자 데이터를 한 번에 읽어 리더보드를 만들 수 없습니다. Firebase Storage는 분석·정렬이 필요한 순위 데이터에 적합하지 않으므로 Firestore에 리더보드 전용 문서를 추가합니다.

## 새 컬렉션

`leaderboardEntries/{entryId}` (entryId는 `uid-sessionId` 형태)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `uid` | string | 점수를 기록한 사용자 ID (작성자 검증용) |
| `label` | string | 이메일 없이 정제된 표시 이름 (기본값 `user-<uid 앞 6자리>` ) |
| `sessionId` | string | 세션 식별자 |
| `sessionDate` | string | 세션 실행 시각 문자열 |
| `score` | number | 세션 점수 |
| `accuracy` | number | 타겟 명중 비율 (%) |
| `avgReactionTime` | number | 마우스/종합 반응 속도 (ms) |
| `gazeAimLatency` | number | 시야 반응 속도 (ms) |
| `gazeAccuracy` | number | 시야 정확도 (%) |
| `mouseAccuracy` | number | 마우스 정확도 (%) |
| `totalTargets` | number | 총 타겟 수 |
| `targetsHit` | number | 명중한 타겟 수 |
| `duration` | number | 세션 길이 (초) |
| `createdAt`/`updatedAt` | serverTimestamp | 정렬·캐싱용 타임스탬프 |

## 보안 규칙

`firestore.rules`에 `leaderboardEntries` 매치를 추가해 **모든 사용자에게 읽기 허용**, 작성·수정·삭제는 인증된 사용자가 자신의 `uid`와 일치하는 문서만 가능하도록 제한했습니다. 저장되는 필드는 PII를 포함하지 않도록 기본적으로 축약된 label을 사용합니다.

## 쓰기 경로

`frontend/src/utils/remoteSessions.ts`의 `saveSessionForUser`가 `leaderboardOptIn` 플래그를 받으면 위 컬렉션에 세션 요약과 `analytics` 값(`calculatePerformanceAnalytics` 결과)을 함께 저장합니다. 익명 세션도 기본 별칭(`user-<uid 앞 6자리>`)으로 포함되며, 추후 리더보드 UI에서는 `leaderboardEntries`를 정렬 쿼리(`orderBy('score', 'desc')` 등)로 읽기만 하면 됩니다.