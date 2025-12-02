#!/usr/bin/env python3
"""
Export session-level feature vectors for modeling.

Each row represents one training session with numeric features that can feed
directly into a regression/classification model.

Features (per row):
- accuracy, mouseAccuracy, gazeAccuracy, avgReactionTime, gazeAimLatency, score
- targetsHit, totalTargets, timePerTarget
- survey fields when present: playTime, inGameRank, mainGame, selfAssessment, aimTrainerUsage, gamesPlayed

Usage examples:
  python export_session_features.py \\
    --credentials path/to/service-account.json \\
    --project your-firebase-project-id \\
    --out session_features.csv

If you have Application Default Credentials set (GOOGLE_APPLICATION_CREDENTIALS),
--credentials is optional.
"""

from __future__ import annotations

import argparse
import csv
import sys
from typing import Any, Dict, List, Optional

import firebase_admin
from firebase_admin import credentials, firestore


def init_firestore(project: Optional[str], credentials_path: Optional[str]) -> firestore.Client:
    """Initialize and return a Firestore client."""
    if firebase_admin._apps:  # type: ignore[attr-defined]
        return firestore.client()

    if credentials_path:
        cred = credentials.Certificate(credentials_path)
        firebase_admin.initialize_app(cred, {"projectId": project} if project else None)
    else:
        firebase_admin.initialize_app()
    return firestore.client()


def fetch_latest_survey(db: firestore.Client, uid: str) -> Dict[str, Any]:
    """Fetch the latest survey response for a user, if any."""
    surveys_ref = (
        db.collection("users")
        .document(uid)
        .collection("surveys")
        .order_by("createdAt", direction=firestore.Query.DESCENDING)
        .limit(1)
    )
    snapshots = surveys_ref.stream()
    for snap in snapshots:
        return snap.to_dict() or {}
    return {}


def safe_number(value: Any) -> Optional[float]:
    """Convert to float when possible, otherwise None."""
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def extract_row(uid: str, doc_data: Dict[str, Any], fallback_survey: Dict[str, Any]) -> Dict[str, Any]:
    """Build a flat feature row from a session document."""
    session = doc_data.get("session") or doc_data
    analytics = doc_data.get("analytics") or {}
    survey = doc_data.get("surveyResponses") or fallback_survey or {}

    total_targets = safe_number(analytics.get("totalTargets") or session.get("totalTargets")) or 0
    duration = safe_number(session.get("duration")) or 0
    time_per_target = duration / total_targets if total_targets else None

    games_played = survey.get("gamesPlayed") or []
    if isinstance(games_played, list):
        games_played_joined = ",".join(games_played)
    else:
        games_played_joined = str(games_played)

    return {
        "uid": uid,
        "sessionId": session.get("id"),
        "sessionDate": session.get("date"),
        "score": safe_number(session.get("score")),
        "accuracy": safe_number(analytics.get("accuracy") or session.get("accuracy")),
        "mouseAccuracy": safe_number(analytics.get("mouseAccuracy") or session.get("mouseAccuracy")),
        "gazeAccuracy": safe_number(analytics.get("gazeAccuracy") or session.get("gazeAccuracy")),
        "avgReactionTime": safe_number(analytics.get("avgReactionTime") or session.get("avgReactionTime")),
        "gazeAimLatency": safe_number(analytics.get("gazeAimLatency") or session.get("gazeAimLatency")),
        "targetsHit": safe_number(analytics.get("targetsHit") or session.get("targetsHit")),
        "totalTargets": total_targets or None,
        "timePerTarget": time_per_target,
        "playTime": survey.get("playTime"),
        "inGameRank": survey.get("inGameRank"),
        "mainGame": survey.get("mainGame"),
        "mainGameOther": survey.get("mainGameOther"),
        "selfAssessment": safe_number(survey.get("selfAssessment")),
        "aimTrainerUsage": survey.get("aimTrainerUsage"),
        "gamesPlayed": games_played_joined,
        "consentAccepted": doc_data.get("consentAccepted", False),
        "leaderboardOptIn": doc_data.get("leaderboardOptIn", False),
    }


def export_features(db: firestore.Client, out_path: str) -> int:
    """Iterate all users/sessions and write a CSV of feature vectors. Returns row count."""
    users = db.collection("users").stream()
    rows: List[Dict[str, Any]] = []

    for user_snap in users:
        uid = user_snap.id
        latest_survey = fetch_latest_survey(db, uid)
        sessions_ref = db.collection("users").document(uid).collection("sessions")
        for session_snap in sessions_ref.stream():
            data = session_snap.to_dict() or {}
            row = extract_row(uid, data, latest_survey)
            rows.append(row)

    if not rows:
        print("No session rows found; nothing to write.", file=sys.stderr)
        return 0

    fieldnames = [
        "uid",
        "sessionId",
        "sessionDate",
        "score",
        "accuracy",
        "mouseAccuracy",
        "gazeAccuracy",
        "avgReactionTime",
        "gazeAimLatency",
        "targetsHit",
        "totalTargets",
        "timePerTarget",
        "playTime",
        "inGameRank",
        "mainGame",
        "mainGameOther",
        "selfAssessment",
        "aimTrainerUsage",
        "gamesPlayed",
        "consentAccepted",
        "leaderboardOptIn",
    ]

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return len(rows)


def main() -> None:
    ap = argparse.ArgumentParser(description="Export session features for modeling.")
    ap.add_argument("--credentials", help="Path to service account JSON (optional if ADC is set).")
    ap.add_argument("--project", help="Firebase project ID (optional).")
    ap.add_argument("--out", default="session_features.csv", help="Output CSV path.")
    args = ap.parse_args()

    db = init_firestore(args.project, args.credentials)
    count = export_features(db, args.out)
    print(f"Wrote {count} rows to {args.out}")


if __name__ == "__main__":
    main()
