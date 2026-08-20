"""
Core dataset engine for DataInsight AI.

Handles: loading CSV/Excel, schema/type inference, data quality profiling,
automated cleaning, descriptive statistics, and outlier detection.

Design note: to keep the app runnable with zero external services beyond
Mongo, cleaned/raw dataframes are cached to disk as parquet under
UPLOAD_DIR/<dataset_id>/ and only lightweight metadata is stored in Mongo.
"""
import os
import re
import uuid
import json
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd

from app.core.config import settings

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# dataset_id is always generated server-side via uuid.uuid4() at ingest time
# (see ingest_file below). We validate the format defensively wherever a
# dataset_id arrives as a path parameter from a caller, so a malformed or
# maliciously crafted id (e.g. containing "../") can never be used to build
# a filesystem path outside UPLOAD_DIR.
_DATASET_ID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def _dataset_dir(dataset_id: str) -> str:
    if not isinstance(dataset_id, str) or not _DATASET_ID_RE.match(dataset_id):
        raise FileNotFoundError(f"Invalid dataset id: {dataset_id!r}")

    path = os.path.join(settings.UPLOAD_DIR, dataset_id)
    os.makedirs(path, exist_ok=True)
    return path


def _raw_path(dataset_id: str) -> str:
    return os.path.join(_dataset_dir(dataset_id), "raw.parquet")


def _clean_path(dataset_id: str) -> str:
    return os.path.join(_dataset_dir(dataset_id), "clean.parquet")


def load_dataframe(dataset_id: str, cleaned: bool = True) -> pd.DataFrame:
    path = _clean_path(dataset_id) if cleaned and os.path.exists(_clean_path(dataset_id)) else _raw_path(dataset_id)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Dataset {dataset_id} not found")
    return pd.read_parquet(path)


def save_dataframe(dataset_id: str, df: pd.DataFrame, cleaned: bool = False) -> None:
    path = _clean_path(dataset_id) if cleaned else _raw_path(dataset_id)
    df.to_parquet(path, index=False)


def _try_parse_datetime(series: pd.Series) -> Optional[pd.Series]:
    if series.dtype == object or "date" in str(series.name).lower() or "time" in str(series.name).lower():
        try:
            parsed = pd.to_datetime(series, errors="coerce")
            # Require most values to parse successfully to call it a datetime column
            if parsed.notna().mean() > 0.7:
                return parsed
        except Exception:
            return None
    return None


def infer_column_type(series: pd.Series) -> str:
    """Return one of: numerical | categorical | datetime | boolean | text"""
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    if pd.api.types.is_numeric_dtype(series):
        # Low-cardinality integer columns are often categorical (e.g. ratings, flags)
        nunique = series.nunique(dropna=True)
        if pd.api.types.is_integer_dtype(series) and nunique <= 15 and nunique / max(len(series), 1) < 0.05:
            return "categorical"
        return "numerical"
    # object/string columns
    if _try_parse_datetime(series) is not None:
        return "datetime"
    nunique = series.nunique(dropna=True)
    avg_len = series.dropna().astype(str).str.len().mean() if series.notna().any() else 0
    if nunique <= max(20, int(0.05 * len(series))) and avg_len < 50:
        return "categorical"
    return "text"


def profile_dataframe(df: pd.DataFrame) -> dict:
    columns = []
    numerical, categorical, datetime_cols, text_cols = [], [], [], []

    for col in df.columns:
        series = df[col]
        inferred = infer_column_type(series)
        if inferred == "numerical":
            numerical.append(col)
        elif inferred == "categorical" or inferred == "boolean":
            categorical.append(col)
        elif inferred == "datetime":
            datetime_cols.append(col)
        else:
            text_cols.append(col)

        missing = int(series.isna().sum())
        sample_vals = series.dropna().unique()[:5].tolist()
        sample_vals = [v.item() if hasattr(v, "item") else v for v in sample_vals]
        columns.append({
            "name": col,
            "dtype": str(series.dtype),
            "inferred_type": inferred,
            "missing_count": missing,
            "missing_pct": round(missing / len(df) * 100, 2) if len(df) else 0.0,
            "unique_count": int(series.nunique(dropna=True)),
            "sample_values": sample_vals,
        })

    duplicate_count = int(df.duplicated().sum())
    missing_cells = int(df.isna().sum().sum())
    total_cells = df.shape[0] * df.shape[1] if df.shape[1] else 1

    return {
        "row_count": int(df.shape[0]),
        "column_count": int(df.shape[1]),
        "duplicate_count": duplicate_count,
        "missing_cells": missing_cells,
        "missing_pct": round(missing_cells / total_cells * 100, 2),
        "columns": columns,
        "numerical_columns": numerical,
        "categorical_columns": categorical,
        "datetime_columns": datetime_cols,
        "text_columns": text_cols,
    }


def ingest_dataframe(df: pd.DataFrame, source_label: str) -> tuple[str, pd.DataFrame, dict]:
    """
    Normalize and persist any already-loaded DataFrame as a new dataset,
    regardless of where it came from (file upload, REST API, a SQL table,
    a Google Sheet, ...).

    This is the single choke point every ingestion path funnels through,
    so EDA/cleaning/ML/RCA/what-if/forecasting/copilot never need to know
    or care about the dataset's origin -- they only ever see a dataset_id.

    `source_label` is only used for error messages/logging; it never
    touches the filesystem path (dataset_id, minted below, does that).
    """
    if df is None or df.empty:
        raise ValueError(f"'{source_label}' produced no rows to import.")

    # Best-effort datetime coercion for object columns that look like dates
    for col in df.columns:
        if df[col].dtype == object:
            parsed = _try_parse_datetime(df[col])
            if parsed is not None:
                df[col] = parsed

    df.columns = [str(c).strip() for c in df.columns]
    dataset_id = str(uuid.uuid4())
    save_dataframe(dataset_id, df, cleaned=False)
    profile = profile_dataframe(df)
    return dataset_id, df, profile


def ingest_file(file_path: str, filename: str) -> tuple[str, pd.DataFrame, dict]:
    """Read an uploaded CSV/XLSX and hand it off to ingest_dataframe."""
    ext = filename.lower().split(".")[-1]
    if ext == "csv":
        df = pd.read_csv(file_path)
    elif ext in ("xlsx", "xls"):
        df = pd.read_excel(file_path)
    else:
        raise ValueError("Unsupported file type. Please upload a .csv or .xlsx file.")

    return ingest_dataframe(df, source_label=filename)


# ---------------------- Cleaning ----------------------

def suggest_cleaning_strategy(profile: dict) -> list[dict]:
    suggestions = []
    for col in profile["columns"]:
        if col["missing_pct"] > 50:
            suggestions.append({
                "column": col["name"],
                "issue": f"{col['missing_pct']}% missing values",
                "suggestion": "Consider dropping this column — over half its values are missing.",
            })
        elif col["missing_pct"] > 0:
            if col["inferred_type"] == "numerical":
                suggestions.append({
                    "column": col["name"],
                    "issue": f"{col['missing_pct']}% missing values",
                    "suggestion": "Impute with median (robust to outliers).",
                })
            elif col["inferred_type"] in ("categorical", "boolean"):
                suggestions.append({
                    "column": col["name"],
                    "issue": f"{col['missing_pct']}% missing values",
                    "suggestion": "Impute with the most frequent category (mode).",
                })
            elif col["inferred_type"] == "datetime":
                suggestions.append({
                    "column": col["name"],
                    "issue": f"{col['missing_pct']}% missing values",
                    "suggestion": "Forward-fill or drop rows, depending on whether the series is sequential.",
                })
            else:
                suggestions.append({
                    "column": col["name"],
                    "issue": f"{col['missing_pct']}% missing values",
                    "suggestion": "Fill with a placeholder ('Unknown') or drop rows.",
                })
    if profile["duplicate_count"] > 0:
        suggestions.append({
            "column": "__all__",
            "issue": f"{profile['duplicate_count']} duplicate rows detected",
            "suggestion": "Drop exact duplicate rows.",
        })
    return suggestions


def clean_dataframe(df: pd.DataFrame, drop_duplicates: bool, missing_strategy: str,
                     columns: Optional[list[str]] = None) -> tuple[pd.DataFrame, dict]:
    original_rows = len(df)
    log = {"steps": []}
    working = df.copy()

    if drop_duplicates:
        before = len(working)
        working = working.drop_duplicates()
        log["steps"].append(f"Dropped {before - len(working)} duplicate rows")

    target_cols = columns if columns else list(working.columns)

    for col in target_cols:
        if col not in working.columns:
            continue
        series = working[col]
        if series.isna().sum() == 0:
            continue
        inferred = infer_column_type(series)
        strategy = missing_strategy

        if strategy == "auto":
            strategy = "median" if inferred == "numerical" else "mode"

        if strategy == "drop_rows":
            before = len(working)
            working = working.dropna(subset=[col])
            log["steps"].append(f"Dropped {before - len(working)} rows with missing '{col}'")
        elif strategy == "drop_columns":
            working = working.drop(columns=[col])
            log["steps"].append(f"Dropped column '{col}' (too many missing values)")
        elif strategy == "zero":
            working[col] = working[col].fillna(0)
            log["steps"].append(f"Filled missing '{col}' with 0")
        elif strategy == "mean" and inferred == "numerical":
            working[col] = working[col].fillna(working[col].mean())
            log["steps"].append(f"Filled missing '{col}' with mean")
        elif strategy == "median" and inferred == "numerical":
            working[col] = working[col].fillna(working[col].median())
            log["steps"].append(f"Filled missing '{col}' with median")
        elif strategy == "mode" or inferred in ("categorical", "boolean", "text"):
            mode_val = working[col].mode(dropna=True)
            fill_val = mode_val.iloc[0] if not mode_val.empty else "Unknown"
            working[col] = working[col].fillna(fill_val)
            log["steps"].append(f"Filled missing '{col}' with mode ('{fill_val}')")
        elif inferred == "datetime":
            working[col] = working[col].ffill()
            log["steps"].append(f"Forward-filled missing '{col}'")

    log["rows_before"] = original_rows
    log["rows_after"] = len(working)
    return working, log


# ---------------------- EDA & Outliers ----------------------

def descriptive_statistics(df: pd.DataFrame, numerical_columns: list[str]) -> dict:
    if not numerical_columns:
        return {}
    desc = df[numerical_columns].describe().transpose()
    desc["skew"] = df[numerical_columns].skew()
    desc["kurtosis"] = df[numerical_columns].kurtosis()
    desc = desc.round(4)
    return json.loads(desc.reset_index().rename(columns={"index": "column"}).to_json(orient="records"))


def correlation_matrix(df: pd.DataFrame, numerical_columns: list[str]) -> dict:
    if len(numerical_columns) < 2:
        return {"columns": numerical_columns, "matrix": []}
    corr = df[numerical_columns].corr(numeric_only=True).round(3)
    return {"columns": list(corr.columns), "matrix": corr.values.tolist()}


def detect_outliers_iqr(df: pd.DataFrame, numerical_columns: list[str]) -> dict:
    results = {}
    for col in numerical_columns:
        series = df[col].dropna()
        if series.empty:
            continue
        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        outliers = series[(series < lower) | (series > upper)]
        results[col] = {
            "count": int(len(outliers)),
            "pct": round(len(outliers) / len(series) * 100, 2) if len(series) else 0,
            "lower_bound": round(float(lower), 4),
            "upper_bound": round(float(upper), 4),
            "sample_values": outliers.head(10).tolist(),
            "treatment_suggestion": (
                "Cap values at the IQR bounds (winsorize)" if len(outliers) / max(len(series), 1) < 0.1
                else "Investigate — a large share of points are flagged; the distribution may be genuinely skewed"
            ),
        }
    return results


def chart_payload(df: pd.DataFrame, profile: dict, max_categories: int = 12, max_points: int = 2000) -> dict:
    """Precompute lightweight JSON payloads the frontend can pass straight to Plotly/Recharts."""
    charts = {"histograms": {}, "bar": {}, "pie": {}, "box": {}, "scatter": None, "line": None}

    num_cols = profile["numerical_columns"]
    cat_cols = profile["categorical_columns"]
    dt_cols = profile["datetime_columns"]

    for col in num_cols[:8]:
        series = df[col].dropna()
        if series.empty:
            continue
        counts, bin_edges = np.histogram(series, bins=20)
        charts["histograms"][col] = {
            "bins": [round(float(b), 3) for b in bin_edges],
            "counts": [int(c) for c in counts],
        }
        charts["box"][col] = {
            "min": float(series.min()), "q1": float(series.quantile(0.25)),
            "median": float(series.median()), "q3": float(series.quantile(0.75)),
            "max": float(series.max()),
        }

    for col in cat_cols[:8]:
        vc = df[col].value_counts().head(max_categories)
        charts["bar"][col] = {"labels": [str(x) for x in vc.index.tolist()], "values": vc.values.tolist()}
        charts["pie"][col] = charts["bar"][col]

    if len(num_cols) >= 2:
        sample = df[num_cols[:2]].dropna()
        if len(sample) > max_points:
            sample = sample.sample(max_points, random_state=42)
        charts["scatter"] = {
            "x_label": num_cols[0], "y_label": num_cols[1],
            "x": sample[num_cols[0]].tolist(), "y": sample[num_cols[1]].tolist(),
        }

    if dt_cols and num_cols:
        dcol, ncol = dt_cols[0], num_cols[0]
        trend = df[[dcol, ncol]].dropna().sort_values(dcol)
        if len(trend) > max_points:
            trend = trend.iloc[:: max(1, len(trend) // max_points)]
        charts["line"] = {
            "x_label": dcol, "y_label": ncol,
            "x": trend[dcol].astype(str).tolist(), "y": trend[ncol].tolist(),
        }

    return charts

def delete_dataset(dataset_id: str) -> bool:
    """
    Permanently delete all files associated with a dataset.
    """
    import shutil

    dataset_dir = _dataset_dir(dataset_id)

    if not os.path.exists(dataset_dir):
        return False

    shutil.rmtree(dataset_dir)

    return True
