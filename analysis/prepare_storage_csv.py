"""
Utility script to download experiment CSVs from Firebase Storage, merge them,
normalize columns, and emit feature/target datasets for downstream regression.

Prerequisites
-------------
- Set `GOOGLE_APPLICATION_CREDENTIALS` (or application default credentials)
  and `FIREBASE_STORAGE_BUCKET` to point at your bucket.
- Install dependencies:
    pip install google-cloud-storage pandas

Usage
-----
python analysis/prepare_storage_csv.py \
    --bucket "$FIREBASE_STORAGE_BUCKET" \
    --prefix "sessions/" \
    --targets "score" "accuracy" "avgReactionTime" \
    --output combined.csv \
    --features-output features.csv \
    --targets-output targets.csv

The script keeps a `source_blob` column so you can trace rows back to the
original file. Columns are lowercased and spaces are replaced with underscores
for easier model ingestion.
"""

import argparse
import os
import tempfile
from typing import Iterable, List

import pandas as pd
from google.cloud import storage


DEFAULT_PREFIX = ""


def list_csv_blobs(bucket: storage.Bucket, prefix: str) -> List[str]:
    """Return CSV blob names under the given prefix."""
    return [blob.name for blob in bucket.list_blobs(prefix=prefix) if blob.name.endswith(".csv")]


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Standardize column names for ML pipelines."""
    df = df.copy()
    df.columns = [col.strip().lower().replace(" ", "_") for col in df.columns]
    timestamp_cols = [col for col in df.columns if "timestamp" in col]
    for col in timestamp_cols:
        df[col] = pd.to_datetime(df[col], errors="ignore")
    return df


def download_and_concat(bucket: storage.Bucket, blob_names: Iterable[str]) -> pd.DataFrame:
    """Download each CSV blob, attach its path as metadata, and concatenate."""
    frames: List[pd.DataFrame] = []
    for name in blob_names:
        blob = bucket.blob(name)
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
            tmp_path = tmp.name
        blob.download_to_filename(tmp_path)
        df = pd.read_csv(tmp_path)
        os.remove(tmp_path)
        df["source_blob"] = name
        frames.append(df)
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def split_features_targets(df: pd.DataFrame, targets: List[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return feature and target frames after aligning columns."""
    normalized = normalize_columns(df)
    target_cols = [col.lower() for col in targets]
    missing = [col for col in target_cols if col not in normalized.columns]
    if missing:
        raise ValueError(f"Target columns not found: {', '.join(missing)}")
    features = normalized.drop(columns=target_cols)
    target_frame = normalized[target_cols]
    return features, target_frame


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge Firebase Storage CSVs for regression training")
    parser.add_argument("--bucket", required=True, help="Firebase Storage bucket name")
    parser.add_argument("--prefix", default=DEFAULT_PREFIX, help="Optional path prefix inside the bucket")
    parser.add_argument("--output", default="combined.csv", help="Path to write the merged dataset")
    parser.add_argument("--features-output", help="Optional path to write feature matrix CSV")
    parser.add_argument("--targets-output", help="Optional path to write target CSV")
    parser.add_argument("--targets", nargs="*", default=[], help="List of target column names for regression")
    parser.add_argument("--drop-na-targets", action="store_true", help="Drop rows with missing target values")
    args = parser.parse_args()

    client = storage.Client()
    bucket = client.bucket(args.bucket)

    blob_names = list_csv_blobs(bucket, args.prefix)
    if not blob_names:
        raise SystemExit("No CSV files found in the specified bucket/prefix.")

    combined = download_and_concat(bucket, blob_names)
    combined = normalize_columns(combined)
    if args.drop_na_targets and args.targets:
        target_cols = [col.lower() for col in args.targets]
        combined = combined.dropna(subset=target_cols)

    combined.to_csv(args.output, index=False)

    if args.targets:
        features, target_frame = split_features_targets(combined, args.targets)
        if args.features_output:
            features.to_csv(args.features_output, index=False)
        if args.targets_output:
            target_frame.to_csv(args.targets_output, index=False)


if __name__ == "__main__":
    main()