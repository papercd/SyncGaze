"""
Minimal HTTP inference function for predictedScore.
- Expects POST JSON: {"features": { ... }} using the keys in FEATURE_ORDER.
- Returns: {"predictedScore": <number>}

For Cloud Functions (Python), expose a functions_framework HTTP handler
instead of a standalone Flask app to avoid container healthcheck issues.
"""

from __future__ import annotations

from typing import Any, Dict, List

import functions_framework
import joblib  # type: ignore
from flask import jsonify, Request

# Load your trained model here. Place model.pkl next to this file before deploy.
# For PyTorch, replace with torch.load and model.eval().
MODEL_PATH = "model.pkl"
model = joblib.load(MODEL_PATH)

# Must match the features used to train model.pkl (7 features).
FEATURE_ORDER: List[str] = [
    "accuracy",
    "mouseAccuracy",
    "gazeAccuracy",
    "avgReactionTime_ms",
    "targetsHit",
    "totalTargets",
    "timePerTarget_s",
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


@functions_framework.http
def predict_score(request: Request):
    """HTTP Cloud Function entry point."""
    payload = request.get_json(silent=True) or {}
    feats = payload.get("features", {})
    vector = build_vector(feats)
    y_hat = float(model.predict([vector])[0])
    return jsonify({"predictedScore": y_hat})


# For local testing: python main.py
if __name__ == "__main__":
    from flask import Flask, request

    flask_app = Flask(__name__)

    @flask_app.route("/", methods=["POST"])
    def predict_local() -> Any:
        return predict_score(request)

    @flask_app.route("/health", methods=["GET"])
    def health() -> Any:
        return jsonify({"status": "ok"})

    flask_app.run(host="0.0.0.0", port=8080, debug=True)
