#!/usr/bin/env python3
"""
Ad-hoc analysis script for gaze_mouse_task_data_(101_ver).csv.

It reproduces the SyncGaze metrics and assembles two axis-specific
summary tables:
1. Timing / Latency
2. Control Quality / Precision

Results are printed to the console and also written to CSV files
alongside the source data.
"""

from __future__ import annotations

from pathlib import Path
import sys
from typing import Dict, List

import numpy as np
import pandas as pd

# Ensure local modules (syncgaze_metrics.py) are importable
# Ensure local modules (syncgaze_metrics.py) are importable
HERE = Path(__file__).resolve().parent
search_paths = [
    HERE,
    HERE / "analysis",
    HERE.parent,
    HERE.parent / "SyncGaze",
    HERE.parent / "SyncGaze" / "analysis",
]
for path in search_paths:
    if path.exists():
        resolved = str(path.resolve())
        if resolved not in sys.path:
            sys.path.insert(0, resolved)

import syncgaze_metrics as sm


def locate_csv() -> Path:
    """Return the resolved path to the 101_ver CSV."""
    candidates = [
        Path("gaze_mouse_task_data_(101_ver).csv"),
        Path("SyncGaze/analysis/gaze_mouse_task_data_(101_ver).csv"),
        Path.cwd() / "gaze_mouse_task_data_(101_ver).csv",
        Path.cwd() / "SyncGaze" / "analysis" / "gaze_mouse_task_data_(101_ver).csv",
    ]
    for cand in candidates:
        if cand.exists():
            return cand.resolve()
    raise FileNotFoundError("Could not locate gaze_mouse_task_data_(101_ver).csv.")


def load_dataframe(csv_path: Path) -> pd.DataFrame:
    """Read and clean the CSV into a numeric dataframe."""
    raw_df = pd.read_csv(csv_path, comment="#", skipinitialspace=True)
    original_rows = len(raw_df)
    numeric_cols = [
        "timestamp",
        "taskId",
        "targetX",
        "targetY",
        "gazeX",
        "gazeY",
        "mouseX",
        "mouseY",
    ]
    for col in numeric_cols:
        raw_df[col] = pd.to_numeric(raw_df[col], errors="coerce")

    filled = (
        raw_df.groupby("taskId", dropna=False, group_keys=False)
        .apply(lambda g: g.sort_values("timestamp").interpolate(limit_direction="both").ffill().bfill())
    )
    filled["taskId"] = filled["taskId"].round().astype(int)
    df = filled.dropna(subset=numeric_cols).copy()
    if df.empty:
        missing_counts = raw_column_missing(raw_df, numeric_cols, original_rows)
        raise ValueError(
            "No valid samples after cleaning. "
            f"Check required columns. Missing counts: {missing_counts}"
        )
    df = df.sort_values(["taskId", "timestamp"]).reset_index(drop=True)
    return df


def raw_column_missing(df: pd.DataFrame, cols: List[str], total_rows: int) -> Dict[str, int]:
    """Helper showing how many rows were dropped per column."""
    counts = {}
    for col in cols:
        counts[col] = int(total_rows - df[col].notna().sum())
    return counts


def compute_metrics(df: pd.DataFrame, params: sm.Params) -> pd.DataFrame:
    """Compute SyncGaze metrics per taskId."""
    rows: List[Dict] = []
    for tid, group in df.groupby("taskId", sort=True):
        metrics = sm.compute_all_metrics(group, params)
        metrics["taskId"] = tid
        rows.append(metrics)
    return pd.DataFrame(rows).sort_values("taskId").reset_index(drop=True)


def derive_spatial_sync(df: pd.DataFrame) -> pd.DataFrame:
    """Extra spatial sync features per taskId."""
    records: List[Dict] = []
    for tid, group in df.groupby("taskId", sort=True):
        target = np.column_stack((group["targetX"], group["targetY"]))
        gaze = np.column_stack((group["gazeX"], group["gazeY"]))
        mouse = np.column_stack((group["mouseX"], group["mouseY"]))

        gaze_dist = np.linalg.norm(gaze - target, axis=1)
        mouse_dist = np.linalg.norm(mouse - target, axis=1)
        gap = np.abs(gaze_dist - mouse_dist)

        records.append(
            {
                "taskId": tid,
                "avgGazeTargetDist": float(np.mean(gaze_dist)),
                "avgMouseTargetDist": float(np.mean(mouse_dist)),
                "avgGazeMouseGap": float(np.mean(gap)),
            }
        )
    return pd.DataFrame(records)


def main() -> None:
    csv_path = locate_csv()
    try:
        df = load_dataframe(csv_path)
    except ValueError as exc:
        print(f"Error cleaning data: {exc}")
        return
    print(f"Loaded {len(df)} samples from {csv_path}")

    params = sm.Params()
    metrics_df = compute_metrics(df, params)

    spatial_df = derive_spatial_sync(df)
    metrics_df = metrics_df.merge(spatial_df, on="taskId", how="left")

    # Timing / latency axis
    timing_cols = [
        "taskId",
        "gazeReactionTime_ms",
        "gazeAimLatency_ms",
        "syncRate",
    ]
    timing_metrics = metrics_df[timing_cols].copy()
    timing_metrics["gazeAimLead_ms"] = timing_metrics["gazeAimLatency_ms"]
    timing_metrics = timing_metrics.sort_values("gazeAimLatency_ms")

    # Control / precision axis
    control_cols = [
        "taskId",
        "flick_accuracy",
        "flick_smoothness",
        "flick_straightness",
        "track_trackingAccuracy",
        "track_predictionScore",
        "syncRate",
        "avgGazeTargetDist",
        "avgMouseTargetDist",
        "avgGazeMouseGap",
    ]
    control_metrics = metrics_df[control_cols].copy()
    control_metrics = control_metrics.sort_values("flick_accuracy")

    out_dir = csv_path.parent
    metrics_df.to_csv(out_dir / "metrics_full_101_ver.csv", index=False)
    timing_metrics.to_csv(out_dir / "metrics_timing_101_ver.csv", index=False)
    control_metrics.to_csv(out_dir / "metrics_control_101_ver.csv", index=False)

    print("\nTiming / Latency metrics (head):")
    print(timing_metrics.head())

    print("\nControl / Precision metrics (head):")
    print(control_metrics.head())

    print("\nSaved summary tables to:")
    print(f"  - {out_dir / 'metrics_timing_101_ver.csv'}")
    print(f"  - {out_dir / 'metrics_control_101_ver.csv'}")
    print(f"  - {out_dir / 'metrics_full_101_ver.csv'} (full metrics)")


if __name__ == "__main__":
    main()
