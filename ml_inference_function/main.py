"""
Minimal HTTP inference function for predictedScore.
- Expects POST JSON: {"features": { ... }} using the keys in FEATURE_ORDER.
- Returns: {"predictedScore": <number>}

Swap model loading as needed (joblib for scikit/xgboost pickle, torch.load for .pt).
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

import joblib  # type: ignore
from flask import Flask, jsonify, request

app = Flask(__name__)

# Load your trained model here. Place model.pkl next to this file before deploy.
# For PyTorch, replace with torch.load and model.eval().
MODEL_PATH = "model.pkl"
model = joblib.load(MODEL_PATH)

# Feature order should match training.
FEATURE_ORDER: List[str] = [
    "accuracy",
    "mouseAccuracy",
    "gazeAccuracy",
    "avgReactionTime_ms",
    "gazeAimLatency_ms",
    "targetsHit",
    "totalTargets",
    "timePerTarget_s",
    "validationError_px",
    "validationStdDev_px",
    "screenWidth",
    "screenHeight",
    "selfAssessment",
]


def build_vector(features: Dict[str, Any]) -> List[float]:
    """Convert incoming features dict into ordered numeric list."""
    vector: List[float] = []
    for key in FEATURE_ORDER:
        val = features.get(key)
        try:
            vector.append(float(val))
        except (TypeError, ValueError):
            vector.append(0.0)
    return vector


@app.route("/", methods=["POST"])
def predict() -> Any:
    payload = request.get_json(force=True, silent=True) or {}
    feats = payload.get("features", {})
    vector = build_vector(feats)
    y_hat = float(model.predict([vector])[0])
    return jsonify({"predictedScore": y_hat})


@app.route("/health", methods=["GET"])
def health() -> Any:
    return jsonify({"status": "ok"})


# For local testing: python main.py
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
