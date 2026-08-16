import pandas as pd

from app.services.what_if_planner import deterministic_plan


def _sample_df():
    return pd.DataFrame(
        {
            "sales": [100, 200, 300, 400],
            "region": ["North", "South", "West", "West"],
            "profit": [10, 20, 30, 40],
        }
    )


def _profile():
    return {
        "numerical_columns": ["sales", "profit"],
        "categorical_columns": ["region"],
    }


def test_detects_segment_when_dimension_name_is_explicitly_mentioned():
    plan = deterministic_plan(
        "What if West region sales increase by 20%?", _sample_df(), _profile()
    )
    assert plan["metric_column"] == "sales"
    assert plan["dimension_column"] == "region"
    assert plan["segment_value"] == "West"
    assert plan["change_percentage"] == 20


def test_detects_segment_from_value_alone_without_dimension_name():
    """
    Regression test: natural phrasing like "What if West sales increase
    by 15%?" never says the word "region", but a human clearly means the
    West segment. The deterministic planner must still recognize this
    instead of silently falling back to whole-dataset scope.
    """
    plan = deterministic_plan(
        "What if West sales increase by 15%?", _sample_df(), _profile()
    )
    assert plan["metric_column"] == "sales"
    assert plan["dimension_column"] == "region"
    assert plan["segment_value"] == "West"
    assert plan["change_percentage"] == 15


def test_no_segment_mentioned_falls_back_to_whole_dataset_metric():
    plan = deterministic_plan(
        "What if sales increase by 15%?", _sample_df(), _profile()
    )
    assert plan["metric_column"] == "sales"
    assert plan["dimension_column"] is None
    assert plan["segment_value"] is None


def test_decrease_wording_produces_negative_percentage():
    plan = deterministic_plan(
        "Decrease sales in West by 10%", _sample_df(), _profile()
    )
    assert plan["change_percentage"] == -10
    assert plan["segment_value"] == "West"
