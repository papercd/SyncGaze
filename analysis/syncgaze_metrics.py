#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SyncGaze Metrics Extractor
--------------------------
Given a CSV with columns:
    timestamp, taskId, targetX, targetY, gazeX, gazeY, mouseX, mouseY

This script computes:
1) Gaze Reaction Time
2) Flick Accuracy & Patterns
3) Tracking Stability
4) Gaze–Aim Latency
5) Synchronization Rate

Assumptions (edit as needed):
- Each taskId corresponds to one target instance (spawn).
- Spawn time = first row timestamp of each taskId group.
- Target radius (px) indicates "inside target". Default 50.
- Click events are not provided; we infer "hit" as the time of minimum
  cursor distance to the target within a time window after movement start,
  or when the cursor enters target radius.
- Movement detection uses velocity threshold + direction similarity toward target.
- Sampling is uniform enough for finite-difference velocity to be meaningful.
"""

from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
import argparse
import math
import numpy as np
import pandas as pd

# ---------------------------- Utilities ----------------------------

def euclidean(x1, y1, x2, y2):
    return math.hypot(x2 - x1, y2 - y1)

def vector(a: Tuple[float, float], b: Tuple[float, float]) -> Tuple[float, float]:
    return (b[0] - a[0], b[1] - a[1])

def dot(u: Tuple[float, float], v: Tuple[float, float]) -> float:
    return u[0]*v[0] + u[1]*v[1]

def norm(u: Tuple[float, float]) -> float:
    return math.hypot(u[0], u[1])

def cosine_similarity(u: Tuple[float, float], v: Tuple[float, float]) -> float:
    nu, nv = norm(u), norm(v)
    if nu == 0 or nv == 0:
        return 0.0
    return dot(u, v) / (nu * nv)

def direction_angle(u: Tuple[float, float]) -> float:
    # angle in radians
    return math.atan2(u[1], u[0])

def stddev(x: np.ndarray) -> float:
    if len(x) <= 1:
        return 0.0
    return float(np.std(x, ddof=1))

def rolling_diff(arr: np.ndarray) -> np.ndarray:
    if len(arr) < 2:
        return np.array([])
    return np.diff(arr)

def path_length(xs: np.ndarray, ys: np.ndarray) -> float:
    if len(xs) < 2:
        return 0.0
    dx = np.diff(xs)
    dy = np.diff(ys)
    return float(np.sum(np.hypot(dx, dy)))

# ---------------------------- Detection helpers ----------------------------

def detect_movements(df: pd.DataFrame,
                     vel_thresh: float,
                     min_duration_ms: int) -> List[Dict]:
    """
    Detect movement segments based on velocity threshold.
    Returns list of dicts with keys: start_idx, end_idx, startTime, endTime, direction(vec)
    """
    # velocity magnitude (pixels / ms)
    dx = df['mouseX'].diff().fillna(0.0).to_numpy()
    dy = df['mouseY'].diff().fillna(0.0).to_numpy()
    dt = df['timestamp'].diff().fillna(1.0).to_numpy()
    # avoid division by zero
    dt[dt == 0] = np.nan
    vel = np.hypot(dx, dy) / dt  # px per ms
    vel = np.nan_to_num(vel, nan=0.0)

    active = vel > vel_thresh
    segments = []
    i = 0
    n = len(df)
    while i < n:
        if active[i]:
            start = i
            while i + 1 < n and active[i+1]:
                i += 1
            end = i
            # check duration
            dur = df['timestamp'].iloc[end] - df['timestamp'].iloc[start]
            if dur >= min_duration_ms:
                vx = df['mouseX'].iloc[end] - df['mouseX'].iloc[start]
                vy = df['mouseY'].iloc[end] - df['mouseY'].iloc[start]
                segments.append({
                    'start_idx': start,
                    'end_idx': end,
                    'startTime': float(df['timestamp'].iloc[start]),
                    'endTime': float(df['timestamp'].iloc[end]),
                    'direction': (float(vx), float(vy))
                })
        i += 1
    return segments

def detect_gaze_movements(df: pd.DataFrame,
                          vel_thresh: float,
                          min_duration_ms: int) -> List[Dict]:
    dx = df['gazeX'].diff().fillna(0.0).to_numpy()
    dy = df['gazeY'].diff().fillna(0.0).to_numpy()
    dt = df['timestamp'].diff().fillna(1.0).to_numpy()
    dt[dt == 0] = np.nan
    vel = np.hypot(dx, dy) / dt
    vel = np.nan_to_num(vel, nan=0.0)

    active = vel > vel_thresh
    segments = []
    i = 0
    n = len(df)
    while i < n:
        if active[i]:
            start = i
            while i + 1 < n and active[i+1]:
                i += 1
            end = i
            dur = df['timestamp'].iloc[end] - df['timestamp'].iloc[start]
            if dur >= min_duration_ms:
                vx = df['gazeX'].iloc[end] - df['gazeX'].iloc[start]
                vy = df['gazeY'].iloc[end] - df['gazeY'].iloc[start]
                segments.append({
                    'start_idx': start,
                    'end_idx': end,
                    'startTime': float(df['timestamp'].iloc[start]),
                    'endTime': float(df['timestamp'].iloc[end]),
                    'direction': (float(vx), float(vy))
                })
        i += 1
    return segments

def first_time_inside_radius(df: pd.DataFrame,
                             center: Tuple[float, float],
                             radius: float,
                             t_min: float) -> Optional[float]:
    mask = df['timestamp'] > t_min
    sub = df.loc[mask]
    if sub.empty:
        return None
    dx = sub['gazeX'].to_numpy() - center[0]
    dy = sub['gazeY'].to_numpy() - center[1]
    dist = np.hypot(dx, dy)
    idx = np.argmax(dist <= radius) if np.any(dist <= radius) else None
    if idx is None:
        return None
    # np.argmax gives first True index in the filtered array
    return float(sub['timestamp'].iloc[idx])

def movement_start_toward_target(df: pd.DataFrame,
                                 target: Tuple[float, float],
                                 spawn_time: float,
                                 similarity_thresh: float,
                                 vel_thresh: float) -> Optional[int]:
    """
    Find index where mouse starts moving toward target after spawn_time
    using direction cosine similarity and velocity threshold.
    Returns index in df or None.
    """
    x = df['mouseX'].to_numpy()
    y = df['mouseY'].to_numpy()
    t = df['timestamp'].to_numpy()
    for i in range(1, len(df)):
        if t[i] <= spawn_time:
            continue
        mv = (x[i] - x[i-1], y[i] - y[i-1])
        tv = (target[0] - x[i-1], target[1] - y[i-1])
        speed = euclidean(x[i-1], y[i-1], x[i], y[i]) / max(t[i] - t[i-1], 1e-6)
        if speed < vel_thresh:
            continue
        sim = cosine_similarity(mv, tv)
        if sim > similarity_thresh:
            return i
    return None

def closest_approach_index(df: pd.DataFrame,
                           target: Tuple[float, float],
                           start_idx: int,
                           search_ms: int) -> Optional[int]:
    """
    After start_idx, within search_ms, find index where mouse is closest to target.
    """
    if start_idx is None:
        return None
    t0 = df['timestamp'].iloc[start_idx]
    sub = df.loc[df['timestamp'].between(t0, t0 + search_ms, inclusive='both')]
    if sub.empty:
        return None
    dx = sub['mouseX'].to_numpy() - target[0]
    dy = sub['mouseY'].to_numpy() - target[1]
    dist = np.hypot(dx, dy)
    j = int(np.argmin(dist))
    return int(sub.index[j])

def smoothness_jitter(df: pd.DataFrame, pos_cols=('mouseX','mouseY'), micro_thresh: float = 5.0) -> Tuple[float, float]:
    xs = df[pos_cols[0]].to_numpy()
    ys = df[pos_cols[1]].to_numpy()
    # micro-movements magnitude per sample
    mags = np.hypot(np.diff(xs, prepend=xs[0]), np.diff(ys, prepend=ys[0]))
    micro = mags[mags < micro_thresh]
    jitter = float(np.std(micro, ddof=1)) if len(micro) > 1 else 0.0
    # smoothness proxy: inverse of average curvature (higher = smoother)
    if len(xs) < 3:
        smooth = 0.0
    else:
        v1x = np.diff(xs, prepend=xs[0])
        v1y = np.diff(ys, prepend=ys[0])
        v2x = np.diff(v1x, prepend=v1x[0])
        v2y = np.diff(v1y, prepend=v1y[0])
        curvature = np.hypot(v2x, v2y)
        mean_curv = float(np.mean(curvature[1:])) if len(curvature) > 1 else 0.0
        smooth = 1.0 / (mean_curv + 1e-6)
    return smooth, jitter

def path_straightness(df: pd.DataFrame,
                      start_idx: int,
                      end_idx: int) -> float:
    xs = df['mouseX'].iloc[start_idx:end_idx+1].to_numpy()
    ys = df['mouseY'].iloc[start_idx:end_idx+1].to_numpy()
    if len(xs) < 2:
        return 0.0
    direct = euclidean(xs[0], ys[0], xs[-1], ys[-1])
    pl = path_length(xs, ys)
    if pl == 0:
        return 0.0
    return float(direct / pl)  # 1.0 = perfectly straight

# ---------------------------- Metrics ----------------------------

@dataclass
class Params:
    target_radius: float = 50.0          # px
    mouse_vel_thresh: float = 0.05       # px/ms (adjust to your sampling rate)
    gaze_vel_thresh: float = 0.05        # px/ms
    min_move_duration_ms: int = 20       # ms
    toward_sim_thresh: float = 0.7       # cosine similarity threshold
    search_window_ms: int = 600          # after movement start, look this long for closest approach
    sync_time_window_ms: int = 100       # gaze<->mouse movement alignment window
    sync_dir_sim_thresh: float = 0.8

def compute_gaze_reaction_time(df: pd.DataFrame, p: Params) -> Optional[float]:
    center = (float(df['targetX'].iloc[0]), float(df['targetY'].iloc[0]))
    spawn_time = float(df['timestamp'].iloc[0])
    t = first_time_inside_radius(df, center, p.target_radius, spawn_time)
    return None if t is None else t - spawn_time

def compute_flick_metrics(df: pd.DataFrame, p: Params) -> Dict[str, Optional[float]]:
    center = (float(df['targetX'].iloc[0]), float(df['targetY'].iloc[0]))
    spawn_time = float(df['timestamp'].iloc[0])

    start_idx = movement_start_toward_target(df, center, spawn_time,
                                             similarity_thresh=p.toward_sim_thresh,
                                             vel_thresh=p.mouse_vel_thresh)
    if start_idx is None:
        return {k: None for k in ['accuracy','overshoot','undershoot','smoothness','peakVelocity','straightness']}

    end_idx = closest_approach_index(df, center, start_idx, p.search_window_ms)
    if end_idx is None or end_idx <= start_idx:
        return {k: None for k in ['accuracy','overshoot','undershoot','smoothness','peakVelocity','straightness']}

    # Accuracy = distance at closest approach
    acc = euclidean(df['mouseX'].iloc[end_idx], df['mouseY'].iloc[end_idx], center[0], center[1])

    # Overshoot / undershoot: compare path extremum vs target line
    # Simple proxy: did the cursor cross past the target center along movement axis?
    start_pos = (df['mouseX'].iloc[start_idx], df['mouseY'].iloc[start_idx])
    end_pos = (df['mouseX'].iloc[end_idx], df['mouseY'].iloc[end_idx])
    mv = vector(start_pos, end_pos)
    tv = vector(start_pos, center)
    proj_len = dot(mv, tv) / (norm(mv) + 1e-6)
    target_len = norm(tv)
    overshoot = float(proj_len > target_len)
    undershoot = float(proj_len < target_len and acc > p.target_radius)

    # Smoothness & peak velocity in segment
    seg = df.iloc[start_idx:end_idx+1]
    smooth, jitter = smoothness_jitter(seg, pos_cols=('mouseX','mouseY'))
    # peak velocity
    dx = seg['mouseX'].diff().fillna(0.0).to_numpy()
    dy = seg['mouseY'].diff().fillna(0.0).to_numpy()
    dt = seg['timestamp'].diff().fillna(1.0).to_numpy()
    dt[dt == 0] = np.nan
    vel = np.nan_to_num(np.hypot(dx, dy) / dt, nan=0.0)
    peak_v = float(np.max(vel)) if len(vel) else 0.0

    straight = path_straightness(df, start_idx, end_idx)

    return {
        'accuracy': float(acc),
        'overshoot': float(overshoot),
        'undershoot': float(undershoot),
        'smoothness': float(smooth),
        'peakVelocity': float(peak_v),
        'straightness': float(straight)
    }

def compute_tracking_stability(df: pd.DataFrame, p: Params) -> Dict[str, Optional[float]]:
    # Generic static-target proxy: track accuracy over a sliding window (if target moves, this still works)
    dx = df['mouseX'].to_numpy() - df['targetX'].to_numpy()
    dy = df['mouseY'].to_numpy() - df['targetY'].to_numpy()
    dist = np.hypot(dx, dy)
    tracking_accuracy = float(np.mean(dist)) if len(dist) else None

    # jitter index (micro movement std)
    smooth, jitter = smoothness_jitter(df, pos_cols=('mouseX','mouseY'))

    # predictive tracking proxy: correlation between mouse velocity and target velocity (lead/lag)
    mvx = df['mouseX'].diff().fillna(0.0).to_numpy()
    mvy = df['mouseY'].diff().fillna(0.0).to_numpy()
    tvx = df['targetX'].diff().fillna(0.0).to_numpy()
    tvy = df['targetY'].diff().fillna(0.0).to_numpy()
    # Use dot-product alignment over time
    dot_align = mvx*tvx + mvy*tvy
    denom = (np.hypot(mvx, mvy) * np.hypot(tvx, tvy)) + 1e-6
    align_cos = dot_align / denom
    prediction_score = float(np.nanmean(align_cos)) if len(align_cos) else None

    return {
        'trackingAccuracy': tracking_accuracy,
        'jitterIndex': float(jitter),
        'predictionScore': prediction_score
    }

def compute_gaze_aim_latency(df: pd.DataFrame, p: Params) -> Dict[str, Optional[float]]:
    center = (float(df['targetX'].iloc[0]), float(df['targetY'].iloc[0]))
    spawn_time = float(df['timestamp'].iloc[0])
    # gaze arrival
    gaze_t = first_time_inside_radius(df, center, p.target_radius, spawn_time)
    # mouse movement start
    start_idx = movement_start_toward_target(df, center, spawn_time,
                                             similarity_thresh=p.toward_sim_thresh,
                                             vel_thresh=p.mouse_vel_thresh)
    if gaze_t is None or start_idx is None:
        return {'latency': None, 'efficiency': None}

    mouse_start_t = float(df['timestamp'].iloc[start_idx])
    latency = mouse_start_t - float(gaze_t)

    # Efficiency proxy: straightness from (mouse_start) to closest approach
    end_idx = closest_approach_index(df, center, start_idx, p.search_window_ms)
    if end_idx is None or end_idx <= start_idx:
        efficiency = None
    else:
        efficiency = path_straightness(df, start_idx, end_idx)

    return {'latency': float(latency), 'efficiency': efficiency if efficiency is None else float(efficiency)}

def compute_sync_rate(df: pd.DataFrame, p: Params) -> Optional[float]:
    gm = detect_gaze_movements(df, vel_thresh=p.gaze_vel_thresh, min_duration_ms=p.min_move_duration_ms)
    mm = detect_movements(df, vel_thresh=p.mouse_vel_thresh, min_duration_ms=p.min_move_duration_ms)
    if not gm:
        return None
    sync = 0
    for g in gm:
        # find mouse movement within time window
        candidates = [m for m in mm if abs(m['startTime'] - g['startTime']) <= p.sync_time_window_ms]
        ok = False
        for m in candidates:
            if cosine_similarity(g['direction'], m['direction']) >= p.sync_dir_sim_thresh:
                ok = True
                break
        if ok:
            sync += 1
    return float(sync) / float(len(gm)) if gm else None

# ---------------------------- Runner ----------------------------

def compute_all_metrics(df_task: pd.DataFrame, params: Params) -> Dict[str, Optional[float]]:
    out = {}
    # sort by time (safety)
    df_task = df_task.sort_values('timestamp').reset_index(drop=True)

    # 1) Gaze Reaction Time
    out['gazeReactionTime_ms'] = compute_gaze_reaction_time(df_task, params)

    # 2) Flick Accuracy & Patterns
    flick = compute_flick_metrics(df_task, params)
    out.update({f'flick_{k}': v for k, v in flick.items()})

    # 3) Tracking Stability
    track = compute_tracking_stability(df_task, params)
    out.update({f'track_{k}': v for k, v in track.items()})

    # 4) Gaze–Aim Latency (+ efficiency)
    gal = compute_gaze_aim_latency(df_task, params)
    out['gazeAimLatency_ms'] = gal['latency']
    out['movementEfficiency'] = gal['efficiency']

    # 5) Synchronization Rate
    out['syncRate'] = compute_sync_rate(df_task, params)

    return out

def validate_columns(df: pd.DataFrame):
    need = ['timestamp','taskId','targetX','targetY','gazeX','gazeY','mouseX','mouseY']
    missing = [c for c in need if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}. Required = {need}")

def main():
    ap = argparse.ArgumentParser(description="SyncGaze Metrics Extractor")
    ap.add_argument('--csv', required=True, help="Path to CSV file")
    ap.add_argument('--out', default='metrics_summary.csv', help="Output CSV (summary per taskId)")
    ap.add_argument('--radius', type=float, default=50.0, help="Target hit radius (px)")
    ap.add_argument('--mouse_vel', type=float, default=0.05, help="Mouse velocity threshold (px/ms)")
    ap.add_argument('--gaze_vel', type=float, default=0.05, help="Gaze velocity threshold (px/ms)")
    ap.add_argument('--min_move_ms', type=int, default=20, help="Minimum movement duration (ms)")
    ap.add_argument('--toward_sim', type=float, default=0.7, help="Cosine similarity threshold toward target")
    ap.add_argument('--search_ms', type=int, default=600, help="Closest-approach search window after movement start (ms)")
    ap.add_argument('--sync_win_ms', type=int, default=100, help="Gaze-mouse sync time window (ms)")
    ap.add_argument('--sync_dir_sim', type=float, default=0.8, help="Direction similarity threshold for sync")
    args = ap.parse_args()

    df = pd.read_csv(args.csv)
    validate_columns(df)

    # ensure numeric
    for c in ['timestamp','taskId','targetX','targetY','gazeX','gazeY','mouseX','mouseY']:
        df[c] = pd.to_numeric(df[c], errors='coerce')
    df = df.dropna(subset=['timestamp','taskId','targetX','targetY','gazeX','gazeY','mouseX','mouseY'])

    params = Params(
        target_radius=args.radius,
        mouse_vel_thresh=args.mouse_vel,
        gaze_vel_thresh=args.gaze_vel,
        min_move_duration_ms=args.min_move_ms,
        toward_sim_thresh=args.toward_sim,
        search_window_ms=args.search_ms,
        sync_time_window_ms=args.sync_win_ms,
        sync_dir_sim_thresh=args.sync_dir_sim
    )

    # group by taskId
    results = []
    for tid, g in df.groupby('taskId', sort=True):
        try:
            metrics = compute_all_metrics(g, params)
        except Exception as e:
            metrics = { 'error': str(e) }
        metrics['taskId'] = tid
        results.append(metrics)

    out_df = pd.DataFrame(results).sort_values('taskId')
    out_df.to_csv(args.out, index=False)
    print(f"Saved: {args.out}")
    # also print head
    with pd.option_context('display.max_columns', 100):
        print(out_df.head())

if __name__ == '__main__':
    main()

