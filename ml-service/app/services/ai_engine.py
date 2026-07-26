"""
Local, statistics-driven AI insight and chat engine. Deterministic, free,
no external API calls — this microservice only ever returns local
analysis. The Node backend layers optional OpenAI enhancement on top of
these results (see backend/src/services/aiEnhancer.js).
"""
import pandas as pd
import numpy as np


# ---------------------- Local statistical insight generation ----------------------

def generate_local_insights(profile: dict, stats: list[dict], corr: dict, outliers: dict) -> list[dict]:
    insights = []

    if profile["missing_pct"] > 5:
        insights.append({
            "type": "data_quality",
            "title": "Missing data detected",
            "detail": f"{profile['missing_pct']}% of all cells are missing across the dataset. "
                      f"Columns most affected: "
                      + ", ".join(c["name"] for c in sorted(profile["columns"], key=lambda c: -c["missing_pct"])[:3]),
        })

    if profile["duplicate_count"] > 0:
        insights.append({
            "type": "data_quality",
            "title": "Duplicate rows found",
            "detail": f"{profile['duplicate_count']} duplicate rows were detected "
                      f"({round(profile['duplicate_count'] / max(profile['row_count'],1) * 100, 1)}% of the dataset).",
        })

    for row in stats:
        skew = row.get("skew", 0)
        if skew and abs(skew) > 1:
            direction = "right" if skew > 0 else "left"
            insights.append({
                "type": "distribution",
                "title": f"'{row['column']}' is skewed",
                "detail": f"'{row['column']}' has a {direction}-skewed distribution (skew={round(skew,2)}). "
                          f"Consider a log transform before feeding it into linear models.",
            })

    if corr.get("matrix"):
        cols = corr["columns"]
        matrix = np.array(corr["matrix"])
        pairs = []
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                pairs.append((cols[i], cols[j], matrix[i][j]))
        pairs.sort(key=lambda p: -abs(p[2]))
        for a, b, v in pairs[:3]:
            if abs(v) > 0.5:
                relation = "positively" if v > 0 else "negatively"
                insights.append({
                    "type": "correlation",
                    "title": f"'{a}' and '{b}' are strongly correlated",
                    "detail": f"'{a}' and '{b}' are {relation} correlated (r={round(float(v), 2)}). "
                              f"Watch for multicollinearity if you use both as model features.",
                })

    for col, info in outliers.items():
        if info["count"] > 0 and info["pct"] > 1:
            insights.append({
                "type": "outliers",
                "title": f"Outliers detected in '{col}'",
                "detail": f"{info['count']} values ({info['pct']}%) fall outside the normal range "
                          f"[{info['lower_bound']}, {info['upper_bound']}]. {info['treatment_suggestion']}.",
            })

    if not insights:
        insights.append({
            "type": "summary",
            "title": "Dataset looks clean",
            "detail": "No major data quality issues, strong skew, strong correlations, or significant "
                      "outlier clusters were detected in this pass.",
        })

    return insights


def generate_local_summary(profile: dict, insights: list[dict]) -> str:
    lines = [
        f"This dataset has {profile['row_count']:,} rows and {profile['column_count']} columns "
        f"({len(profile['numerical_columns'])} numerical, {len(profile['categorical_columns'])} categorical, "
        f"{len(profile['datetime_columns'])} datetime).",
    ]
    if profile["missing_pct"] > 0:
        lines.append(f"Overall data completeness is {round(100 - profile['missing_pct'], 1)}%.")
    top_findings = [i["title"] for i in insights[:4]]
    if top_findings:
        lines.append("Key findings: " + "; ".join(top_findings) + ".")
    return " ".join(lines)


# ---------------------- Chat with data ----------------------

_INTENTS = {
    "missing": ["missing", "null", "na value", "incomplete"],
    "correlation": ["correlation", "correlate", "relationship between"],
    "anomaly": ["anomaly", "anomalies", "outlier", "unusual"],
    "trend": ["trend", "over time", "monthly", "growth", "forecast", "predict"],
    "summary": ["summarize", "summary", "overview", "describe"],
    "strategy": ["strategy", "recommend", "suggest", "advice", "action"],
    "top": ["top", "highest", "best", "largest", "most"],
    "bottom": ["bottom", "lowest", "worst", "smallest", "least"],
}


def _detect_intent(message: str) -> str:
    msg = message.lower()
    for intent, keywords in _INTENTS.items():
        if any(k in msg for k in keywords):
            return intent
    return "general"


def _find_mentioned_column(message: str, columns: list[str]) -> str | None:
    msg = message.lower()
    for col in sorted(columns, key=len, reverse=True):
        if col.lower() in msg:
            return col
    return None


def answer_chat_locally(message: str, df: pd.DataFrame, profile: dict) -> dict:
    intent = _detect_intent(message)
    num_cols = profile["numerical_columns"]
    cat_cols = profile["categorical_columns"]
    mentioned = _find_mentioned_column(message, list(df.columns))

    if intent == "missing":
        missing = df.isna().sum()
        missing = missing[missing > 0].sort_values(ascending=False)
        if missing.empty:
            return {"answer": "No missing values were found in this dataset.", "data": None}
        top = missing.head(10)
        return {
            "answer": "Columns with missing values (most affected first): "
                      + ", ".join(f"{c} ({v})" for c, v in top.items()),
            "data": {"labels": top.index.tolist(), "values": top.values.tolist()},
        }

    if intent in ("top", "bottom"):
        target = mentioned if mentioned in num_cols else (num_cols[0] if num_cols else None)
        group_col = next((c for c in cat_cols if c.lower() in message.lower()), cat_cols[0] if cat_cols else None)
        if target and group_col:
            agg = df.groupby(group_col)[target].sum().sort_values(ascending=(intent == "bottom"))
            top5 = agg.head(5)
            direction = "highest" if intent == "top" else "lowest"
            return {
                "answer": f"{direction.capitalize()} '{target}' by '{group_col}': "
                          + ", ".join(f"{k} ({round(v,2)})" for k, v in top5.items()),
                "data": {"labels": top5.index.astype(str).tolist(), "values": top5.values.tolist()},
            }
        if target:
            sorted_vals = df[[target]].dropna().sort_values(target, ascending=(intent == "bottom")).head(5)
            return {
                "answer": f"{'Highest' if intent=='top' else 'Lowest'} values of '{target}': "
                          + ", ".join(str(round(v, 2)) for v in sorted_vals[target].tolist()),
                "data": None,
            }
        return {"answer": "I couldn't find a numeric column to rank — try naming one specifically.", "data": None}

    if intent == "correlation":
        if len(num_cols) < 2:
            return {"answer": "There aren't at least two numeric columns to correlate.", "data": None}
        corr = df[num_cols].corr(numeric_only=True)
        corr_pairs = corr.where(~np.eye(len(corr), dtype=bool)).abs().unstack().sort_values(ascending=False)
        top_pair = corr_pairs.index[0]
        val = corr.loc[top_pair[0], top_pair[1]]
        return {
            "answer": f"The strongest relationship is between '{top_pair[0]}' and '{top_pair[1]}' (r={round(float(val),2)}).",
            "data": None,
        }

    if intent == "anomaly":
        from app.services.data_processing import detect_outliers_iqr
        outliers = detect_outliers_iqr(df, num_cols)
        flagged = {c: v for c, v in outliers.items() if v["count"] > 0}
        if not flagged:
            return {"answer": "No significant outliers were detected in the numeric columns.", "data": None}
        summary = ", ".join(f"{c} ({v['count']} points, {v['pct']}%)" for c, v in flagged.items())
        return {"answer": f"Anomalies detected in: {summary}.", "data": None}

    if intent == "trend" and profile["datetime_columns"] and num_cols:
        dcol = profile["datetime_columns"][0]
        ncol = mentioned if mentioned in num_cols else num_cols[0]
        ts = df[[dcol, ncol]].dropna().sort_values(dcol)
        if ts.empty:
            return {"answer": f"Not enough data to chart a trend for '{ncol}'.", "data": None}
        monthly = ts.set_index(dcol)[ncol].resample("M").sum()
        direction = "increased" if monthly.iloc[-1] >= monthly.iloc[0] else "decreased"
        return {
            "answer": f"'{ncol}' has {direction} over the observed period "
                      f"(from {round(monthly.iloc[0],2)} to {round(monthly.iloc[-1],2)}). "
                      f"Use the Forecasting tab for a projected trend.",
            "data": {"labels": monthly.index.astype(str).tolist(), "values": monthly.values.tolist()},
        }

    if intent == "summary":
        return {
            "answer": generate_local_summary(profile, generate_local_insights(
                profile, [], {}, {})),
            "data": None,
        }

    if intent == "strategy":
        tips = []
        if num_cols and cat_cols:
            tips.append(f"Segment '{num_cols[0]}' by '{cat_cols[0]}' to find under/over-performing groups.")
        if profile["datetime_columns"]:
            tips.append("Run the forecasting model to anticipate near-term trends and plan capacity/inventory.")
        if profile["missing_pct"] > 5:
            tips.append("Clean missing data first — it's currently affecting "
                        f"{profile['missing_pct']}% of cells and can bias any model trained on it.")
        if not tips:
            tips.append("Run the AI Insights tab for a full automated read of this dataset.")
        return {"answer": " ".join(tips), "data": None}

    # general / fallback
    return {
        "answer": "I can answer questions about missing data, top/bottom values, trends, correlations, "
                  "anomalies, or give a dataset summary — try asking things like "
                  "\"what are the top products by revenue\" or \"show monthly sales trend\".",
        "data": None,
    }
