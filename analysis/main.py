import joblib
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

FEATURES = [
    "accuracy",
    "mouseAccuracy",
    "gazeAccuracy",
    "avgReactionTime_ms",
    "gazeAimLatency_ms",  # 새로 계산된 시선-마우스 지연
    "targetsHit",
    "totalTargets",
    "timePerTarget_s",
]  # CSV 컬럼에 맞춰 수정
TARGET = "score"  # CSV의 타깃 컬럼명으로 수정

df = pd.read_csv("analysis/session_features_local.csv")
X = df[FEATURES].fillna(df[FEATURES].median(numeric_only=True))
y = df[TARGET]

Xtr, Xv, ytr, yv = train_test_split(X, y, test_size=0.2, random_state=42)
model = RandomForestRegressor(n_estimators=400, random_state=42)
model.fit(Xtr, ytr)
print("MAE:", mean_absolute_error(yv, model.predict(Xv)))

joblib.dump(model, "model.pkl")  # 기본 경로 유지
dated_path = f"model_{datetime.now().strftime('%Y%m%d')}.pkl"
joblib.dump(model, dated_path)
print(f"Saved to model.pkl and {dated_path}")
