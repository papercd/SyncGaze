# Firebase Storage CSV preprocessing for regression

Firebase Storage에 쌓여 있는 실험 CSV를 모아 다차원 회귀 학습용 데이터셋으로
변환하는 절차입니다. `analysis/prepare_storage_csv.py` 스크립트가 병합·전처리·
특징/타깃 분리를 자동화합니다.

## 준비물
- 서비스 계정 JSON 등 Google Cloud 인증 (예: `GOOGLE_APPLICATION_CREDENTIALS` 환경변수)
- 대상 버킷 이름 (예: `FIREBASE_STORAGE_BUCKET`)
- Python 의존성: `pip install google-cloud-storage pandas`

## 실행 예시
```bash
python analysis/prepare_storage_csv.py \
  --bucket "$FIREBASE_STORAGE_BUCKET" \
  --prefix "sessions/" \
  --targets "score" "accuracy" "avgReactionTime" \
  --drop-na-targets \
  --output combined.csv \
  --features-output features.csv \
  --targets-output targets.csv
```

- `source_blob` 컬럼으로 행이 어느 원본 CSV에서 왔는지 추적할 수 있습니다.
- 모든 컬럼은 소문자/스네이크케이스로 정규화되고 `timestamp`가 포함된 필드는
  자동으로 `datetime`으로 파싱됩니다.
- `--targets`를 지정하면 동일한 타깃 이름(대소문자 무시)을 갖는 컬럼을 찾아
  결측치 행을 제거(`--drop-na-targets`)하고, 특징/타깃 CSV를 별도 출력합니다.

## 모든 CSV를 하나의 파일로 합치는 순서
아래 순서를 그대로 따르면 버킷에 있는 모든 CSV를 로컬 하나의 파일로 모을 수 있습니다.

1. **인증 정보 준비**: Firebase 프로젝트용 서비스 계정 JSON 경로를 `GOOGLE_APPLICATION_CREDENTIALS` 환경변수에 설정합니다.
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
   ```
2. **버킷 이름 확인**: Firebase Storage 버킷을 확인하고 `FIREBASE_STORAGE_BUCKET` 환경변수로 설정합니다.
   ```bash
   export FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   ```
3. **필요 패키지 설치** (한 번만 실행):
   ```bash
   pip install google-cloud-storage pandas
   ```
4. **스크립트 실행**: 병합 결과를 저장할 로컬 파일 경로를 지정해 실행합니다. 버킷의 특정 폴더에만 CSV가 있다면 `--prefix`로 경로를 전달하세요.
   ```bash
   python analysis/prepare_storage_csv.py \
     --bucket "$FIREBASE_STORAGE_BUCKET" \
     --prefix "sessions/" \
     --output combined.csv
   ```
   - 모든 CSV가 병합되어 `combined.csv`로 저장됩니다.
   - 추가로 타깃 컬럼을 지정해 특징/타깃을 분리하려면 `--targets columnA columnB --features-output features.csv --targets-output targets.csv`를 함께 사용하세요.
5. **결과 확인**: `combined.csv`를 열어 `source_blob` 컬럼으로 각 행이 어떤 원본 파일에서 왔는지 확인할 수 있습니다.

## 다음 단계 아이디어
- `scikit-learn`의 `train_test_split`을 적용해 학습/검증용 분할 추가
- `StandardScaler`, `OneHotEncoder` 등으로 수치/범주형 전처리 파이프라인 구성
- 학습/평가 스크립트를 notebooks 또는 CI 파이프라인에 통합