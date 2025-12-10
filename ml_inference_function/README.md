# ML Inference HTTP Function (Python)

작동 방식
- POST `/{}`에 `{"features": {...}}` JSON을 보내면 `{"predictedScore": <number>}`를 반환합니다.
- `FEATURE_ORDER`는 `session_features_local.csv` 학습 스키마와 동일하게 맞춰둔 상태입니다.
- `model.pkl`(예: scikit-learn / XGBoost pickle)을 같은 폴더에 두고 배포하세요. PyTorch(.pt)로 바꿀 경우 `main.py`의 모델 로딩 부분만 교체하면 됩니다.

배포 예시 (Google Cloud Functions / Python HTTP)
```bash
cd ml_inference_function
gcloud functions deploy predictScore \
  --runtime python311 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point app
```
배포 후 나온 URL을 Node Functions의 환경변수 `PERFORMANCE_MODEL_ENDPOINT`로 설정하면, 새 세션마다 자동 호출되어 `predictedScore`가 저장됩니다.
