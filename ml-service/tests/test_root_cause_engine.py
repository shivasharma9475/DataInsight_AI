import pandas as pd

from app.services.root_cause_engine import (
    analyze_period_change,
)


def test_identifies_major_contributor_to_revenue_decline():
    df = pd.DataFrame({
        "date": [
            "2026-01-10",
            "2026-01-15",
            "2026-02-10",
            "2026-02-15",
        ],

        "region": [
            "North",
            "South",
            "North",
            "South",
        ],

        "revenue": [
            600,
            400,
            300,
            350,
        ],
    })

    result = analyze_period_change(
        df=df,
        date_column="date",
        metric_column="revenue",
        dimension_columns=["region"],
    )

    comparison = result["comparison"]

    assert comparison["previous_value"] == 1000
    assert comparison["current_value"] == 650
    assert comparison["absolute_change"] == -350
    assert comparison["percentage_change"] == -35.0
    assert comparison["direction"] == "decrease"

    contributors = result["dimensions"][0]["contributors"]

    north = next(
        item
        for item in contributors
        if item["value"] == "North"
    )

    south = next(
        item
        for item in contributors
        if item["value"] == "South"
    )

    assert north["change"] == -300
    assert south["change"] == -50

    assert round(north["contribution_pct"], 2) == 85.71

    assert (
        result["dimensions"][0]
        ["reconciliation"]["error"]
        == 0
    )

def test_period_aggregation_uses_exact_monthly_totals():
    df = pd.DataFrame({
        "date": [
            "2025-04-01",
            "2025-04-02",
            "2025-05-01",
            "2025-05-02",
        ],
        "sales": [
            100,
            200,
            50,
            100,
        ],
    })

    result = analyze_period_change(
        df=df,
        date_column="date",
        metric_column="sales",
        period="M",
    )

    comparison = result["comparison"]

    assert comparison["previous_period"] == "2025-04"
    assert comparison["current_period"] == "2025-05"

    assert comparison["previous_value"] == 300
    assert comparison["current_value"] == 150

    assert comparison["absolute_change"] == -150
    assert comparison["percentage_change"] == -50.0
    assert comparison["direction"] == "decrease"

def test_comparable_period_compares_same_day_range():
    df = pd.DataFrame({
        "date": [
            # April full month sample
            "2025-04-01",
            "2025-04-10",
            "2025-04-14",
            "2025-04-20",
            "2025-04-30",

            # May only available through May 14
            "2025-05-01",
            "2025-05-10",
            "2025-05-14",
        ],
        "sales": [
            100,
            200,
            300,
            400,
            500,
            120,
            220,
            330,
        ],
        "region": [
            "North",
            "North",
            "South",
            "South",
            "North",
            "North",
            "North",
            "South",
        ],
    })

    result = analyze_period_change(
        df=df,
        date_column="date",
        metric_column="sales",
        dimension_columns=["region"],
        period="M",
        comparison_mode="comparable",
    )

    comparison = result["comparison"]

    # April must only use Apr 1-14:
    # 100 + 200 + 300 = 600
    assert comparison["previous_value"] == 600

    # May 1-14:
    # 120 + 220 + 330 = 670
    assert comparison["current_value"] == 670

    assert comparison["absolute_change"] == 70

    assert round(comparison["percentage_change"], 2) == 11.67

    assert comparison["direction"] == "increase"

    quality = result["analysis_quality"]

    assert quality["comparison_mode"] == "comparable"
    assert quality["current_period_complete"] is False
    assert quality["current_period_last_day"] == 14
    assert quality["warning"] is not None

def test_weekly_comparable_period_compares_same_elapsed_days():
    """
    Current week has data only for Monday-Wednesday.

    Comparable mode should compare:
        Previous week: Monday-Wednesday
        Current week:  Monday-Wednesday

    It must NOT include Thursday-Sunday from the previous week.
    """

    df = pd.DataFrame({
        "date": [
            # Previous week: Mon-Sun
            "2026-07-06",  # Monday
            "2026-07-07",  # Tuesday
            "2026-07-08",  # Wednesday
            "2026-07-09",  # Thursday
            "2026-07-10",  # Friday
            "2026-07-11",  # Saturday
            "2026-07-12",  # Sunday

            # Current week: Mon-Wed only
            "2026-07-13",  # Monday
            "2026-07-14",  # Tuesday
            "2026-07-15",  # Wednesday
        ],

        "sales": [
            # Previous Mon-Wed = 600
            100,
            200,
            300,

            # These must be excluded in comparable mode
            400,
            500,
            600,
            700,

            # Current Mon-Wed = 750
            150,
            250,
            350,
        ],

        "region": [
            "North",
            "North",
            "South",
            "South",
            "North",
            "South",
            "North",

            "North",
            "North",
            "South",
        ],
    })

    result = analyze_period_change(
        df=df,
        date_column="date",
        metric_column="sales",
        dimension_columns=["region"],
        period="W",
        comparison_mode="comparable",
    )

    comparison = result["comparison"]

    # Previous comparable window:
    # Jul 6-8 = 100 + 200 + 300
    assert comparison["previous_value"] == 600

    # Current window:
    # Jul 13-15 = 150 + 250 + 350
    assert comparison["current_value"] == 750

    assert comparison["absolute_change"] == 150

    assert round(
        comparison["percentage_change"],
        2,
    ) == 25.0

    assert comparison["direction"] == "increase"

    # --------------------------------------------------
    # Analysis quality
    # --------------------------------------------------

    quality = result["analysis_quality"]

    assert quality["comparison_mode"] == "comparable"

    assert quality["current_period_complete"] is False

    assert quality["warning"] is not None

    # Verify actual comparable windows.
    window = quality["comparison_window"]

    assert window["previous_start"] == "2026-07-06"
    assert window["previous_end"] == "2026-07-08"

    assert window["current_start"] == "2026-07-13"
    assert window["current_end"] == "2026-07-15"

    # --------------------------------------------------
    # Dimension contribution
    # --------------------------------------------------

    region_result = result["dimensions"][0]

    assert region_result["dimension"] == "region"

    contributors = region_result["contributors"]

    north = next(
        item
        for item in contributors
        if item["value"] == "North"
    )

    south = next(
        item
        for item in contributors
        if item["value"] == "South"
    )

    # Previous:
    # North = 100 + 200 = 300
    # South = 300
    #
    # Current:
    # North = 150 + 250 = 400
    # South = 350

    assert north["previous_value"] == 300
    assert north["current_value"] == 400
    assert north["change"] == 100

    assert south["previous_value"] == 300
    assert south["current_value"] == 350
    assert south["change"] == 50

    # Overall change = +150
    #
    # North contribution = 100 / 150 = 66.67%
    # South contribution = 50 / 150 = 33.33%

    assert round(
        north["contribution_pct"],
        2,
    ) == 66.67

    assert round(
        south["contribution_pct"],
        2,
    ) == 33.33

    # --------------------------------------------------
    # Reconciliation
    # --------------------------------------------------

    reconciliation = region_result["reconciliation"]

    assert reconciliation["dimension_change"] == 150
    assert reconciliation["overall_change"] == 150
    assert reconciliation["error"] == 0

def test_quarterly_comparable_period_compares_same_elapsed_window():
    """
    Current quarter Q2 has data only through May 14.

    Q2 starts Apr 1.
    Apr 1 -> May 14 represents 43 elapsed days.

    Therefore comparable mode should compare the same elapsed
    duration from Q1:
        Jan 1 -> Feb 13

    Data after Feb 13 in Q1 must not participate.
    """

    df = pd.DataFrame({
        "date": [
            # Previous quarter Q1
            "2026-01-01",
            "2026-01-20",
            "2026-02-13",

            # Must be excluded from comparable window
            "2026-02-14",
            "2026-03-01",
            "2026-03-31",

            # Current quarter Q2 through May 14
            "2026-04-01",
            "2026-04-20",
            "2026-05-14",
        ],

        "sales": [
            # Comparable Q1 total = 600
            100,
            200,
            300,

            # Must NOT be included
            400,
            500,
            600,

            # Current comparable Q2 total = 750
            150,
            250,
            350,
        ],

        "region": [
            "North",
            "North",
            "South",

            "South",
            "North",
            "South",

            "North",
            "North",
            "South",
        ],
    })

    result = analyze_period_change(
        df=df,
        date_column="date",
        metric_column="sales",
        dimension_columns=["region"],
        period="Q",
        comparison_mode="comparable",
    )

    comparison = result["comparison"]

    # --------------------------------------------------
    # Overall comparison
    # --------------------------------------------------

    # Previous comparable window:
    # Jan 1 -> Feb 13
    # 100 + 200 + 300 = 600
    assert comparison["previous_value"] == 600

    # Current Q2 available window:
    # Apr 1 -> May 14
    # 150 + 250 + 350 = 750
    assert comparison["current_value"] == 750

    assert comparison["absolute_change"] == 150

    assert round(
        comparison["percentage_change"],
        2,
    ) == 25.0

    assert comparison["direction"] == "increase"

    # --------------------------------------------------
    # Analysis quality
    # --------------------------------------------------

    quality = result["analysis_quality"]

    assert quality["comparison_mode"] == "comparable"

    assert quality["current_period_complete"] is False

    assert quality["warning"] is not None

    window = quality["comparison_window"]

    assert window["previous_start"] == "2026-01-01"
    assert window["previous_end"] == "2026-02-13"

    assert window["current_start"] == "2026-04-01"
    assert window["current_end"] == "2026-05-14"

    # --------------------------------------------------
    # Dimension contributions
    # --------------------------------------------------

    region_result = result["dimensions"][0]

    assert region_result["dimension"] == "region"

    contributors = region_result["contributors"]

    north = next(
        item
        for item in contributors
        if item["value"] == "North"
    )

    south = next(
        item
        for item in contributors
        if item["value"] == "South"
    )

    # Previous comparable Q1:
    # North = 100 + 200 = 300
    # South = 300
    #
    # Current Q2:
    # North = 150 + 250 = 400
    # South = 350

    assert north["previous_value"] == 300
    assert north["current_value"] == 400
    assert north["change"] == 100

    assert south["previous_value"] == 300
    assert south["current_value"] == 350
    assert south["change"] == 50

    # --------------------------------------------------
    # Contribution percentages
    # --------------------------------------------------

    assert round(
        north["contribution_pct"],
        2,
    ) == 66.67

    assert round(
        south["contribution_pct"],
        2,
    ) == 33.33

    # --------------------------------------------------
    # Reconciliation
    # --------------------------------------------------

    reconciliation = region_result["reconciliation"]

    assert reconciliation["dimension_change"] == 150
    assert reconciliation["overall_change"] == 150
    assert reconciliation["error"] == 0

def test_yearly_comparable_period_compares_same_elapsed_window():
    """
    Current year has data only through May 14, 2026.

    Comparable mode should compare:
        Jan 1-May 14, 2025
        vs
        Jan 1-May 14, 2026

    Rows after May 14, 2025 must be excluded.
    """

    df = pd.DataFrame({
        "date": [
            # Previous year — comparable window
            "2025-01-01",
            "2025-03-10",
            "2025-05-14",

            # Previous year — must be excluded
            "2025-05-15",
            "2025-08-01",
            "2025-12-31",

            # Current year through May 14
            "2026-01-01",
            "2026-03-10",
            "2026-05-14",
        ],

        "sales": [
            # Previous comparable total = 600
            100,
            200,
            300,

            # Must NOT participate
            400,
            500,
            600,

            # Current total = 750
            150,
            250,
            350,
        ],

        "region": [
            "North",
            "North",
            "South",

            "South",
            "North",
            "South",

            "North",
            "North",
            "South",
        ],
    })

    result = analyze_period_change(
        df=df,
        date_column="date",
        metric_column="sales",
        dimension_columns=["region"],
        period="Y",
        comparison_mode="comparable",
    )

    comparison = result["comparison"]

    # --------------------------------------------------
    # Overall comparison
    # --------------------------------------------------

    assert comparison["previous_value"] == 600
    assert comparison["current_value"] == 750

    assert comparison["absolute_change"] == 150

    assert round(
        comparison["percentage_change"],
        2,
    ) == 25.0

    assert comparison["direction"] == "increase"

    # --------------------------------------------------
    # Analysis quality
    # --------------------------------------------------

    quality = result["analysis_quality"]

    assert quality["comparison_mode"] == "comparable"

    assert quality["current_period_complete"] is False

    assert quality["warning"] is not None

    window = quality["comparison_window"]

    assert window["previous_start"] == "2025-01-01"
    assert window["previous_end"] == "2025-05-14"

    assert window["current_start"] == "2026-01-01"
    assert window["current_end"] == "2026-05-14"

    # --------------------------------------------------
    # Region contributions
    # --------------------------------------------------

    region_result = result["dimensions"][0]

    contributors = region_result["contributors"]

    north = next(
        item
        for item in contributors
        if item["value"] == "North"
    )

    south = next(
        item
        for item in contributors
        if item["value"] == "South"
    )

    # Previous:
    #
    # North:
    # 100 + 200 = 300
    #
    # South:
    # 300
    #
    # Current:
    #
    # North:
    # 150 + 250 = 400
    #
    # South:
    # 350

    assert north["previous_value"] == 300
    assert north["current_value"] == 400
    assert north["change"] == 100

    assert south["previous_value"] == 300
    assert south["current_value"] == 350
    assert south["change"] == 50

    # --------------------------------------------------
    # Contribution %
    # --------------------------------------------------

    assert round(
        north["contribution_pct"],
        2,
    ) == 66.67

    assert round(
        south["contribution_pct"],
        2,
    ) == 33.33

    # --------------------------------------------------
    # Reconciliation
    # --------------------------------------------------

    reconciliation = region_result["reconciliation"]

    assert reconciliation["dimension_change"] == 150
    assert reconciliation["overall_change"] == 150
    assert reconciliation["error"] == 0

def test_daily_period_compares_previous_day_with_current_day():
    """
    Daily analysis should compare the latest available day
    with the previous available day.

    For date-only datasets, each available day is treated
    as a complete period.
    """

    df = pd.DataFrame({
        "date": [
            # Previous day
            "2026-07-20",
            "2026-07-20",
            "2026-07-20",

            # Current day
            "2026-07-21",
            "2026-07-21",
            "2026-07-21",
        ],

        "sales": [
            # Previous total = 600
            100,
            200,
            300,

            # Current total = 750
            150,
            250,
            350,
        ],

        "region": [
            "North",
            "North",
            "South",

            "North",
            "North",
            "South",
        ],
    })

    result = analyze_period_change(
        df=df,
        date_column="date",
        metric_column="sales",
        dimension_columns=["region"],
        period="D",
        comparison_mode="comparable",
    )

    comparison = result["comparison"]

    # --------------------------------------------------
    # Overall comparison
    # --------------------------------------------------

    assert comparison["previous_value"] == 600
    assert comparison["current_value"] == 750

    assert comparison["absolute_change"] == 150

    assert round(
        comparison["percentage_change"],
        2,
    ) == 25.0

    assert comparison["direction"] == "increase"

    # --------------------------------------------------
    # Analysis quality
    # --------------------------------------------------

    quality = result["analysis_quality"]

    assert quality["comparison_mode"] == "comparable"

    # Date-only daily data is considered complete.
    assert quality["current_period_complete"] is True

    assert quality["warning"] is None

    window = quality["comparison_window"]

    assert window["previous_start"] == "2026-07-20"
    assert window["previous_end"] == "2026-07-20"

    assert window["current_start"] == "2026-07-21"
    assert window["current_end"] == "2026-07-21"

    # --------------------------------------------------
    # Dimension contribution
    # --------------------------------------------------

    region_result = result["dimensions"][0]

    assert region_result["dimension"] == "region"

    contributors = region_result["contributors"]

    north = next(
        item
        for item in contributors
        if item["value"] == "North"
    )

    south = next(
        item
        for item in contributors
        if item["value"] == "South"
    )

    # Previous:
    # North = 100 + 200 = 300
    # South = 300
    #
    # Current:
    # North = 150 + 250 = 400
    # South = 350

    assert north["previous_value"] == 300
    assert north["current_value"] == 400
    assert north["change"] == 100

    assert south["previous_value"] == 300
    assert south["current_value"] == 350
    assert south["change"] == 50

    # --------------------------------------------------
    # Contribution percentages
    # --------------------------------------------------

    assert round(
        north["contribution_pct"],
        2,
    ) == 66.67

    assert round(
        south["contribution_pct"],
        2,
    ) == 33.33

    # --------------------------------------------------
    # Reconciliation
    # --------------------------------------------------

    reconciliation = region_result["reconciliation"]

    assert reconciliation["dimension_change"] == 150
    assert reconciliation["overall_change"] == 150
    assert reconciliation["error"] == 0

def test_full_and_comparable_modes_produce_different_monthly_results():
    """
    April contains data through Apr 30.
    May contains data only through May 14.

    full:
        Compare all April data vs all available May data.

    comparable:
        Compare Apr 1-14 vs May 1-14.

    Both modes should therefore produce different results.
    """

    df = pd.DataFrame({
        "date": [
            # April
            "2026-04-01",
            "2026-04-10",
            "2026-04-14",
            "2026-04-20",
            "2026-04-30",

            # May — incomplete through May 14
            "2026-05-01",
            "2026-05-10",
            "2026-05-14",
        ],

        "sales": [
            # Apr 1-14 = 600
            100,
            200,
            300,

            # Later April data
            400,
            500,

            # May 1-14 = 750
            150,
            250,
            350,
        ],

        "region": [
            "North",
            "North",
            "South",
            "South",
            "North",

            "North",
            "North",
            "South",
        ],
    })

    # --------------------------------------------------
    # FULL MODE
    # --------------------------------------------------

    full_result = analyze_period_change(
        df=df,
        date_column="date",
        metric_column="sales",
        dimension_columns=["region"],
        period="M",
        comparison_mode="full",
    )

    full = full_result["comparison"]

    # Entire April:
    # 100 + 200 + 300 + 400 + 500 = 1500
    assert full["previous_value"] == 1500

    # Available May:
    # 150 + 250 + 350 = 750
    assert full["current_value"] == 750

    assert full["absolute_change"] == -750

    assert round(
        full["percentage_change"],
        2,
    ) == -50.0

    assert full["direction"] == "decrease"

    # Even though full mode does not truncate April,
    # metadata should still detect that May is incomplete.
    full_quality = full_result["analysis_quality"]

    assert full_quality["comparison_mode"] == "full"
    assert full_quality["current_period_complete"] is False

    # --------------------------------------------------
    # COMPARABLE MODE
    # --------------------------------------------------

    comparable_result = analyze_period_change(
        df=df,
        date_column="date",
        metric_column="sales",
        dimension_columns=["region"],
        period="M",
        comparison_mode="comparable",
    )

    comparable = comparable_result["comparison"]

    # Apr 1-14 only:
    # 100 + 200 + 300 = 600
    assert comparable["previous_value"] == 600

    # May 1-14:
    # 150 + 250 + 350 = 750
    assert comparable["current_value"] == 750

    assert comparable["absolute_change"] == 150

    assert round(
        comparable["percentage_change"],
        2,
    ) == 25.0

    assert comparable["direction"] == "increase"

    comparable_quality = comparable_result[
        "analysis_quality"
    ]

    assert (
        comparable_quality["comparison_mode"]
        == "comparable"
    )

    assert (
        comparable_quality["current_period_complete"]
        is False
    )

    assert comparable_quality["warning"] is not None

    # --------------------------------------------------
    # Critical behavior check
    # --------------------------------------------------

    # Same dataset:
    #
    # Full:
    # April 1500 -> May 750 = -50%
    #
    # Comparable:
    # April 600 -> May 750 = +25%
    #
    # This is exactly why comparable-period analysis
    # matters for incomplete periods.

    assert (
        full["previous_value"]
        != comparable["previous_value"]
    )

    assert (
        full["absolute_change"]
        != comparable["absolute_change"]
    )

    assert (
        full["direction"]
        != comparable["direction"]
    )

    # --------------------------------------------------
    # Comparable reconciliation
    # --------------------------------------------------

    region_result = comparable_result[
        "dimensions"
    ][0]

    reconciliation = region_result[
        "reconciliation"
    ]

    assert reconciliation["dimension_change"] == 150
    assert reconciliation["overall_change"] == 150
    assert reconciliation["error"] == 0

def test_comparable_mode_does_not_truncate_complete_month():
    """
    Both April and May reach their calendar month end.

    Even when comparison_mode="comparable", the engine should
    compare the complete April period with the complete May period.

    No incomplete-period warning should be generated.
    """

    df = pd.DataFrame({
        "date": [
            # April — reaches month end
            "2026-04-01",
            "2026-04-10",
            "2026-04-20",
            "2026-04-30",

            # May — reaches month end
            "2026-05-01",
            "2026-05-10",
            "2026-05-20",
            "2026-05-31",
        ],

        "sales": [
            # April total = 1000
            100,
            200,
            300,
            400,

            # May total = 1200
            150,
            250,
            350,
            450,
        ],

        "region": [
            "North",
            "North",
            "South",
            "South",

            "North",
            "North",
            "South",
            "South",
        ],
    })

    result = analyze_period_change(
        df=df,
        date_column="date",
        metric_column="sales",
        dimension_columns=["region"],
        period="M",
        comparison_mode="comparable",
    )

    comparison = result["comparison"]

    # --------------------------------------------------
    # Full periods must be used
    # --------------------------------------------------

    assert comparison["previous_value"] == 1000
    assert comparison["current_value"] == 1200

    assert comparison["absolute_change"] == 200

    assert round(
        comparison["percentage_change"],
        2,
    ) == 20.0

    assert comparison["direction"] == "increase"

    # --------------------------------------------------
    # Current period should be detected as complete
    # --------------------------------------------------

    quality = result["analysis_quality"]

    assert quality["comparison_mode"] == "comparable"

    assert quality["current_period_complete"] is True

    # No comparable-window warning is necessary.
    assert quality["warning"] is None

    # --------------------------------------------------
    # Windows should remain complete
    # --------------------------------------------------

    window = quality["comparison_window"]

    assert window["previous_start"] == "2026-04-01"
    assert window["previous_end"] == "2026-04-30"

    assert window["current_start"] == "2026-05-01"
    assert window["current_end"] == "2026-05-31"

    # --------------------------------------------------
    # Region contributions
    # --------------------------------------------------

    region_result = result["dimensions"][0]

    contributors = region_result["contributors"]

    north = next(
        item
        for item in contributors
        if item["value"] == "North"
    )

    south = next(
        item
        for item in contributors
        if item["value"] == "South"
    )

    # April:
    # North = 100 + 200 = 300
    # South = 300 + 400 = 700
    #
    # May:
    # North = 150 + 250 = 400
    # South = 350 + 450 = 800

    assert north["previous_value"] == 300
    assert north["current_value"] == 400
    assert north["change"] == 100

    assert south["previous_value"] == 700
    assert south["current_value"] == 800
    assert south["change"] == 100

    # Overall change = +200
    # Each region contributed +100 = 50%.

    assert round(
        north["contribution_pct"],
        2,
    ) == 50.0

    assert round(
        south["contribution_pct"],
        2,
    ) == 50.0

    # --------------------------------------------------
    # Reconciliation
    # --------------------------------------------------

    reconciliation = region_result["reconciliation"]

    assert reconciliation["dimension_change"] == 200
    assert reconciliation["overall_change"] == 200
    assert reconciliation["error"] == 0

def test_zero_previous_value_does_not_divide_by_zero():
    """
    Previous period total is zero and current period is positive.

    Percentage change is mathematically undefined when the
    previous value is zero, so the engine should return None
    instead of raising ZeroDivisionError.
    """

    df = pd.DataFrame({
        "date": [
            # Previous month
            "2026-04-01",
            "2026-04-30",

            # Current month
            "2026-05-01",
            "2026-05-31",
        ],

        "sales": [
            # April total = 0
            0,
            0,

            # May total = 500
            200,
            300,
        ],

        "region": [
            "North",
            "South",
            "North",
            "South",
        ],
    })

    result = analyze_period_change(
        df=df,
        date_column="date",
        metric_column="sales",
        dimension_columns=["region"],
        period="M",
        comparison_mode="full",
    )

    comparison = result["comparison"]

    # --------------------------------------------------
    # Overall metric
    # --------------------------------------------------

    assert comparison["previous_value"] == 0
    assert comparison["current_value"] == 500

    assert comparison["absolute_change"] == 500

    # Percentage change from zero is undefined.
    assert comparison["percentage_change"] is None

    assert comparison["direction"] == "increase"

    # --------------------------------------------------
    # Dimension contributors
    # --------------------------------------------------

    region_result = result["dimensions"][0]

    contributors = region_result["contributors"]

    north = next(
        item
        for item in contributors
        if item["value"] == "North"
    )

    south = next(
        item
        for item in contributors
        if item["value"] == "South"
    )

    # North: 0 -> 200
    assert north["previous_value"] == 0
    assert north["current_value"] == 200
    assert north["change"] == 200

    # South: 0 -> 300
    assert south["previous_value"] == 0
    assert south["current_value"] == 300
    assert south["change"] == 300

    # Overall change = 500
    # North = 40%
    # South = 60%

    assert round(
        north["contribution_pct"],
        2,
    ) == 40.0

    assert round(
        south["contribution_pct"],
        2,
    ) == 60.0

    # --------------------------------------------------
    # Reconciliation
    # --------------------------------------------------

    reconciliation = region_result["reconciliation"]

    assert reconciliation["dimension_change"] == 500
    assert reconciliation["overall_change"] == 500
    assert reconciliation["error"] == 0


def test_zero_overall_change_handles_offsetting_contributors():
    """
    Overall metric remains unchanged:

        Previous = 1000
        Current  = 1000
        Change   = 0

    But individual regions changed:

        North: 400 -> 600 = +200
        South: 600 -> 400 = -200

    The engine should:
        - return direction = no_change
        - return percentage_change = 0
        - preserve individual contributor changes
        - avoid division by zero for contribution percentages
        - reconcile back to zero
    """

    df = pd.DataFrame({
        "date": [
            # Previous month
            "2026-04-01",
            "2026-04-30",

            # Current month
            "2026-05-01",
            "2026-05-31",
        ],

        "sales": [
            # April total = 1000
            400,
            600,

            # May total = 1000
            600,
            400,
        ],

        "region": [
            "North",
            "South",
            "North",
            "South",
        ],
    })

    result = analyze_period_change(
        df=df,
        date_column="date",
        metric_column="sales",
        dimension_columns=["region"],
        period="M",
        comparison_mode="full",
    )

    comparison = result["comparison"]

    # --------------------------------------------------
    # Overall metric
    # --------------------------------------------------

    assert comparison["previous_value"] == 1000
    assert comparison["current_value"] == 1000

    assert comparison["absolute_change"] == 0

    # Previous value is non-zero:
    # 0 / 1000 * 100 = 0%
    assert comparison["percentage_change"] == 0.0

    assert comparison["direction"] == "no_change"

    # --------------------------------------------------
    # Contributors
    # --------------------------------------------------

    region_result = result["dimensions"][0]

    contributors = region_result["contributors"]

    north = next(
        item
        for item in contributors
        if item["value"] == "North"
    )

    south = next(
        item
        for item in contributors
        if item["value"] == "South"
    )

    # North increased by 200.
    assert north["previous_value"] == 400
    assert north["current_value"] == 600
    assert north["change"] == 200
    assert north["impact"] == "positive"

    # South decreased by 200.
    assert south["previous_value"] == 600
    assert south["current_value"] == 400
    assert south["change"] == -200
    assert south["impact"] == "negative"

    # --------------------------------------------------
    # Contribution %
    # --------------------------------------------------
    #
    # total_change == 0, so contribution percentages
    # cannot meaningfully be calculated as:
    #
    # segment_change / total_change
    #
    # Current engine intentionally returns 0.0.

    assert north["contribution_pct"] == 0.0
    assert south["contribution_pct"] == 0.0

    # --------------------------------------------------
    # Reconciliation
    # --------------------------------------------------

    reconciliation = region_result["reconciliation"]

    # +200 + (-200) = 0
    assert reconciliation["dimension_change"] == 0

    assert reconciliation["overall_change"] == 0

    assert reconciliation["error"] == 0

def test_missing_dimension_values_are_preserved_and_reconciled():
    """
    Missing dimension values should not disappear from RCA.

    Because _analyze_dimension uses:

        groupby(dimension, dropna=False)

    rows with missing region values should participate in
    both contributor analysis and reconciliation.

    Previous:
        North   = 400
        Missing = 600
        Total   = 1000

    Current:
        North   = 500
        Missing = 300
        Total   = 800

    Overall change = -200

    Contributions:
        North   = +100
        Missing = -300

    +100 + (-300) = -200
    """

    df = pd.DataFrame({
        "date": [
            "2026-04-01",
            "2026-04-30",

            "2026-05-01",
            "2026-05-31",
        ],

        "sales": [
            400,
            600,

            500,
            300,
        ],

        "region": [
            "North",
            None,

            "North",
            None,
        ],
    })

    result = analyze_period_change(
        df=df,
        date_column="date",
        metric_column="sales",
        dimension_columns=["region"],
        period="M",
        comparison_mode="full",
    )

    comparison = result["comparison"]

    # --------------------------------------------------
    # Overall metric
    # --------------------------------------------------

    assert comparison["previous_value"] == 1000
    assert comparison["current_value"] == 800

    assert comparison["absolute_change"] == -200

    assert round(
        comparison["percentage_change"],
        2,
    ) == -20.0

    assert comparison["direction"] == "decrease"

    # --------------------------------------------------
    # Contributors
    # --------------------------------------------------

    region_result = result["dimensions"][0]

    contributors = region_result["contributors"]

    north = next(
        item
        for item in contributors
        if item["value"] == "North"
    )

    # Missing values are currently converted using:
    #
    #     str(value)
    #
    # Pandas may represent the missing group as "nan".
    missing = next(
    item
    for item in contributors
    if item["value"].lower() in {
        "missing",
        "nan",
        "none",
        "<na>",
    }
)

    # --------------------------------------------------
    # North
    # --------------------------------------------------

    assert north["previous_value"] == 400
    assert north["current_value"] == 500

    assert north["change"] == 100
    assert north["impact"] == "positive"

    # total change = -200
    #
    # +100 / -200 * 100 = -50%
    assert round(
        north["contribution_pct"],
        2,
    ) == -50.0

    # --------------------------------------------------
    # Missing region
    # --------------------------------------------------

    assert missing["previous_value"] == 600
    assert missing["current_value"] == 300

    assert missing["change"] == -300
    assert missing["impact"] == "negative"

    # -300 / -200 * 100 = 150%
    assert round(
        missing["contribution_pct"],
        2,
    ) == 150.0

    # --------------------------------------------------
    # Reconciliation
    # --------------------------------------------------

    reconciliation = region_result[
        "reconciliation"
    ]

    # North +100
    # Missing -300
    #
    # Total = -200

    assert reconciliation["dimension_change"] == -200

    assert reconciliation["overall_change"] == -200

    assert reconciliation["error"] == 0

