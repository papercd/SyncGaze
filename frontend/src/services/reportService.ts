// frontend/src/services/reportService.ts
import { collection, doc, setDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface PerformanceMetrics {
  reactionTime: number;
  reactionTimePercentile: number;
  overlapScore: number;
  overlapScorePercentile: number;
  gazeReactionTime?: number;
  gazeReactionTimePercentile?: number;
  gazeAimLatency?: number;
  gazeAimLatencyPercentile?: number;
  trackingAccuracy: number;
  accuracy: number;
  targetsHit: number;
  totalTargets: number;
  predictedScore?: number | null;
  calibrationError?: number | null;
}

export interface PerformanceReport {
  id: string;
  userId: string;
  sessionId: string;
  content: string; // Markdown content from LLM
  metrics: PerformanceMetrics;
  generatedAt: string;
}

interface GenerateReportParams {
  userId: string;
  sessionId: string;
  reactionTime: number;
  overlapScore: number;
  trackingAccuracy: number;
  accuracy: number;
  targetsHit: number;
  totalTargets: number;
  predictedScore?: number | null;
  gazeReactionTime?: number;
  gazeAimLatency?: number;
  calibrationError?: number | null;
}

// Calculate percentiles based on typical FPS player distributions
const calculatePercentiles = (metrics: {
  reactionTime: number;
  overlapScore: number;
  gazeReactionTime?: number;
  gazeAimLatency?: number;
}): {
  reactionTimePercentile: number;
  overlapScorePercentile: number;
  gazeReactionTimePercentile: number | null;
  gazeAimLatencyPercentile: number | null;
} => {
  // Reaction time percentiles (lower is better)
  // Elite: <200ms, Good: 200-250ms, Average: 250-300ms, Below avg: >300ms
  let reactionTimePercentile = 50;
  if (metrics.reactionTime < 200) reactionTimePercentile = 10;
  else if (metrics.reactionTime < 250) reactionTimePercentile = 25;
  else if (metrics.reactionTime < 300) reactionTimePercentile = 50;
  else if (metrics.reactionTime < 350) reactionTimePercentile = 70;
  else reactionTimePercentile = 85;

  // Overlap score percentiles (higher is better)
  // Elite: >85%, Good: 75-85%, Average: 60-75%, Below avg: <60%
  let overlapScorePercentile = 50;
  if (metrics.overlapScore > 85) overlapScorePercentile = 10;
  else if (metrics.overlapScore > 75) overlapScorePercentile = 20;
  else if (metrics.overlapScore > 65) overlapScorePercentile = 40;
  else if (metrics.overlapScore > 55) overlapScorePercentile = 60;
  else overlapScorePercentile = 70;

  // Gaze reaction (lower is better)
  let gazeReactionTimePercentile: number | null = null;
  if (metrics.gazeReactionTime != null) {
    const v = metrics.gazeReactionTime;
    if (v <= 200) gazeReactionTimePercentile = 12;
    else if (v <= 250) gazeReactionTimePercentile = 25;
    else if (v <= 350) gazeReactionTimePercentile = 45;
    else if (v <= 450) gazeReactionTimePercentile = 65;
    else gazeReactionTimePercentile = 88;
  }

  // Gaze-aim latency (lower is better)
  let gazeAimLatencyPercentile: number | null = null;
  if (metrics.gazeAimLatency != null) {
    const v = metrics.gazeAimLatency;
    if (v <= 250) gazeAimLatencyPercentile = 15;
    else if (v <= 400) gazeAimLatencyPercentile = 35;
    else if (v <= 600) gazeAimLatencyPercentile = 60;
    else gazeAimLatencyPercentile = 85;
  }

  return { reactionTimePercentile, overlapScorePercentile, gazeReactionTimePercentile, gazeAimLatencyPercentile };
};

// Generate performance report using Claude API via backend
export const generatePerformanceReport = async (
  params: GenerateReportParams
): Promise<PerformanceReport> => {
  const percentiles = calculatePercentiles({
    reactionTime: params.reactionTime,
    overlapScore: params.overlapScore,
    gazeReactionTime: params.gazeReactionTime,
    gazeAimLatency: params.gazeAimLatency,
  });

  const prompt = `[Role]
당신은 전직 FPS 프로게이머이자 전문 e스포츠 코치입니다.

[Input Data]
- 플레이어 ID: ${params.userId}
- 측정된 반응 속도: ${params.reactionTime.toFixed(0)}ms (상위 ${percentiles.reactionTimePercentile}% 수준)
- 시선-에임 일치도: ${params.overlapScore.toFixed(1)}% (상위 ${percentiles.overlapScorePercentile}% 수준)
- 트래킹 정확도: ${params.trackingAccuracy.toFixed(1)}%
- 종합 정확도: ${params.accuracy.toFixed(1)}%
- 적중률: ${params.targetsHit}/${params.totalTargets} (${((params.targetsHit / params.totalTargets) * 100).toFixed(1)}%)
${params.predictedScore != null ? `- 예측 점수: ${params.predictedScore.toFixed(1)} (0-100 스케일, 모델 기반)` : ''}
${params.predictedScore == null ? '- 예측 점수가 없어 기존 점수/정확도를 기준으로 평가합니다.' : ''}
${params.predictedScore != null ? '- 점수 해석: 0~100에서 100에 가까울수록 상위 퍼포먼스' : ''}
${params.calibrationError != null ? `- 캘리브레이션 오차: ${params.calibrationError.toFixed(2)}px` : ''}
${params.gazeReactionTime != null ? `- 시선 반응 시간: ${params.gazeReactionTime.toFixed(0)}ms${percentiles.gazeReactionTimePercentile != null ? ` (상위 ${percentiles.gazeReactionTimePercentile}% 수준)` : ''}` : ''}
${params.gazeAimLatency != null ? `- 시선-마우스 지연: ${params.gazeAimLatency.toFixed(0)}ms${percentiles.gazeAimLatencyPercentile != null ? ` (상위 ${percentiles.gazeAimLatencyPercentile}% 수준)` : ''}` : ''}

[Task]
위 데이터를 바탕으로 플레이어에게 구체적인 피드백 리포트를 작성해주세요.
1. "종합 평가": 현재 실력에 대한 요약 (2-3문장)
2. "강점": 데이터에서 잘 나온 부분 칭찬 (구체적인 수치 언급, 강점인 포인트 각각에 대해여 2-3 문장)
3. "약점 및 개선점": 수치가 낮은 부분에 대한 지적 (구체적인 수치 언급, 약점 및 개선점인 포인트 각각에 대해여 2-3 문장)
4. "맞춤형 훈련법": 약점을 보완하기 위해 SyncGaze 트레이닝 그라운드에서 어떻게 연습해야 하는지 구체적인 루틴 제안 (3-4개의 실천 가능한 단계)

[Format]
Markdown 형식으로 출력해주세요. 헤더는 ##을 사용하고, 각 섹션을 명확하게 구분해주세요.

[Tone]
- 전문적이면서도 친근한 코치 톤
- 비판보다는 건설적인 피드백과 동기부여 중심
- 구체적인 수치와 함께 설명
- 너무 길지 않게 (전체 800-1000자 정도)`;

  try {
    // Get backend URL from environment or use default
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 
                       import.meta.env.VITE_BACKEND_URL || 
                       'http://localhost:4000';
    
    const response = await fetch(`${backendUrl}/api/generate-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Backend API error:', response.status, errorData);
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0].text;

    const report: PerformanceReport = {
      id: `report_${Date.now()}`,
      userId: params.userId,
      sessionId: params.sessionId,
      content,
      metrics: {
        reactionTime: params.reactionTime,
        reactionTimePercentile: percentiles.reactionTimePercentile,
        overlapScore: params.overlapScore,
        overlapScorePercentile: percentiles.overlapScorePercentile,
        gazeReactionTime: params.gazeReactionTime,
        gazeReactionTimePercentile: percentiles.gazeReactionTimePercentile ?? undefined,
        gazeAimLatency: params.gazeAimLatency,
        gazeAimLatencyPercentile: percentiles.gazeAimLatencyPercentile ?? undefined,
        trackingAccuracy: params.trackingAccuracy,
        accuracy: params.accuracy,
        targetsHit: params.targetsHit,
        totalTargets: params.totalTargets,
        predictedScore: params.predictedScore ?? null,
        calibrationError: params.calibrationError,
      },
      generatedAt: new Date().toISOString(),
    };

    return report;
  } catch (error) {
    console.error('Failed to generate report:', error);
    throw new Error('리포트 생성에 실패했습니다.');
  }
};

// Save report to Firestore
export const saveReport = async (userId: string, report: PerformanceReport): Promise<void> => {
  try {
    const reportRef = doc(db, 'users', userId, 'reports', report.id);
    await setDoc(reportRef, {
      ...report,
      generatedAt: Timestamp.fromDate(new Date(report.generatedAt)),
    });
  } catch (error) {
    console.error('Failed to save report:', error);
    throw new Error('리포트 저장에 실패했습니다.');
  }
};

// Get all reports for a user
export const getUserReports = async (userId: string): Promise<PerformanceReport[]> => {
  try {
    const reportsRef = collection(db, 'users', userId, 'reports');
    const q = query(reportsRef, orderBy('generatedAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        generatedAt: data.generatedAt.toDate().toISOString(),
      } as PerformanceReport;
    });
  } catch (error) {
    console.error('Failed to fetch reports:', error);
    return [];
  }
};
