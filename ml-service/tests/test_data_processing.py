import pandas as pd
import numpy as np

from app.services.data_processing import (
    profile_dataframe,
    clean_dataframe,
    detect_outliers_iqr,
    load_dataframe,
)


def test_load_dataframe_rejects_non_uuid_dataset_id():
    """
    dataset_id always originates from uuid.uuid4() at ingest time. Any
    caller passing a non-UUID value (e.g. a path-traversal payload like
    "../../etc/passwd") must get a clean "not found" instead of the id
    being used to build a filesystem path.
    """
    for malicious_id in ["../../etc/passwd", "..", "a/b", "a\\b", ""]:
        try:
            load_dataframe(malicious_id)
            assert False, f"expected FileNotFoundError for {malicious_id!r}"
        except FileNotFoundError:
            pass


def test_profile_dataframe_counts_rows_columns_and_duplicates():
    df = pd.DataFrame({
        "product": ["A", "A", "B", "C"],
        "sales": [100, 100, 200, 300],
    })

    profile = profile_dataframe(df)

    assert profile["row_count"] == 4
    assert profile["column_count"] == 2
    assert profile["duplicate_count"] == 1


def test_profile_dataframe_detects_missing_values():
    df = pd.DataFrame({
        "sales": [100, None, 300, None],
        "quantity": [1, 2, 3, 4],
    })

    profile = profile_dataframe(df)

    assert profile["missing_cells"] == 2
    assert profile["missing_pct"] == 25.0


def test_clean_dataframe_removes_duplicates():
    df = pd.DataFrame({
        "product": ["A", "A", "B"],
        "sales": [100, 100, 200],
    })

    cleaned, log = clean_dataframe(
        df,
        drop_duplicates=True,
        missing_strategy="auto",
    )

    assert len(cleaned) == 2
    assert log["rows_before"] == 3
    assert log["rows_after"] == 2


def test_clean_dataframe_fills_numeric_missing_value_with_median():
    df = pd.DataFrame({
        "sales": [100.0, 200.0, np.nan, 300.0, 400.0],
    })

    cleaned, _ = clean_dataframe(
        df,
        drop_duplicates=False,
        missing_strategy="median",
    )

    assert cleaned["sales"].isna().sum() == 0
    assert cleaned.loc[2, "sales"] == 250.0


def test_detect_outliers_iqr():
    df = pd.DataFrame({
        "sales": [
            100, 101, 99, 102, 98,
            100, 101, 99, 100, 5000,
        ]
    })

    result = detect_outliers_iqr(
        df,
        numerical_columns=["sales"],
    )

    assert result["sales"]["count"] == 1
    assert 5000 in result["sales"]["sample_values"]