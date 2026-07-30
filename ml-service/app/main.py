"""
Internal ML/data-science microservice for DataInsight AI.

This service is NOT exposed to the browser. It has no auth, no users,
no ownership concept — the Node/Express backend is the only caller,
authenticates end users itself, and forwards requests here with an
internal API key. This mirrors the InventoryPro pattern: Node owns the
web-facing app, Python owns the heavy data/ML work.
"""
import os
import io
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Depends
from fastapi.responses import StreamingResponse

from app.core.config import settings, INTERNAL_API_KEY
from app.services import data_processing as dp
from app.services import ml_engine
from app.services import ai_engine
from app.services import report_engine
from app.services import (
    root_cause_engine,
    copilot_engine,
)

app = FastAPI(title="DataInsight AI — ML Service (internal)")


async def require_internal_key(x_internal_key: str = Header(default="")):
    if x_internal_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden: invalid or missing internal key")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/ingest", dependencies=[Depends(require_internal_key)])
async def ingest(file: UploadFile = File(...)):
    tmp_path = os.path.join(settings.UPLOAD_DIR, f"_tmp_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)
    try:
        dataset_id, df, profile = dp.ingest_file(tmp_path, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    return {"dataset_id": dataset_id, "profile": profile}


@app.get("/datasets/{dataset_id}/profile", dependencies=[Depends(require_internal_key)])
async def profile(dataset_id: str):
    df = _load_or_404(dataset_id)
    return dp.profile_dataframe(df)


@app.get("/datasets/{dataset_id}/cleaning-suggestions", dependencies=[Depends(require_internal_key)])
async def cleaning_suggestions(dataset_id: str):
    df = _load_or_404(dataset_id)
    profile_data = dp.profile_dataframe(df)
    return {"suggestions": dp.suggest_cleaning_strategy(profile_data)}


@app.post("/datasets/clean", dependencies=[Depends(require_internal_key)])
async def clean(payload: dict):
    dataset_id = payload["dataset_id"]
    df = _load_or_404(dataset_id, cleaned=False)
    cleaned_df, log = dp.clean_dataframe(
        df,
        payload.get("drop_duplicates", True),
        payload.get("missing_strategy", "auto"),
        payload.get("columns"),
    )
    dp.save_dataframe(dataset_id, cleaned_df, cleaned=True)
    return {"log": log, "profile": dp.profile_dataframe(cleaned_df)}


@app.get("/datasets/{dataset_id}/eda", dependencies=[Depends(require_internal_key)])
async def eda(dataset_id: str):
    df = _load_or_404(dataset_id)
    profile_data = dp.profile_dataframe(df)
    stats = dp.descriptive_statistics(df, profile_data["numerical_columns"])
    corr = dp.correlation_matrix(df, profile_data["numerical_columns"])
    return {"profile": profile_data, "descriptive_statistics": stats, "correlation": corr}


@app.get("/datasets/{dataset_id}/outliers", dependencies=[Depends(require_internal_key)])
async def outliers(dataset_id: str):
    df = _load_or_404(dataset_id)
    profile_data = dp.profile_dataframe(df)
    return dp.detect_outliers_iqr(df, profile_data["numerical_columns"])


@app.get("/datasets/{dataset_id}/charts", dependencies=[Depends(require_internal_key)])
async def charts(dataset_id: str):
    df = _load_or_404(dataset_id)
    profile_data = dp.profile_dataframe(df)
    return dp.chart_payload(df, profile_data)


@app.get("/datasets/{dataset_id}/preview", dependencies=[Depends(require_internal_key)])
async def preview(dataset_id: str, limit: int = 50):
    df = _load_or_404(dataset_id)
    return {"columns": list(df.columns), "rows": df.head(limit).fillna("").astype(str).values.tolist()}


@app.get("/ml/{dataset_id}/recommend", dependencies=[Depends(require_internal_key)])
async def recommend(dataset_id: str):
    df = _load_or_404(dataset_id)
    profile_data = dp.profile_dataframe(df)
    return ml_engine.recommend_task(profile_data)


@app.post("/ml/run", dependencies=[Depends(require_internal_key)])
async def ml_run(payload: dict):
    dataset_id = payload["dataset_id"]
    task = payload["task"]
    df = _load_or_404(dataset_id)
    profile_data = dp.profile_dataframe(df)

    target_column = payload.get("target_column")
    features = payload.get("feature_columns") or [
        c for c in (profile_data["numerical_columns"] + profile_data["categorical_columns"])
        if c != target_column
    ]

    try:
        if task == "classification":
            if not target_column:
                raise HTTPException(400, "target_column is required for classification")
            return ml_engine.run_classification(df, target_column, features, payload.get("algorithm"))
        if task == "regression":
            if not target_column:
                raise HTTPException(400, "target_column is required for regression")
            return ml_engine.run_regression(df, target_column, features, payload.get("algorithm"))
        if task == "clustering":
            return ml_engine.run_clustering(df, features, payload.get("algorithm"))
        if task == "forecasting":
            date_col = payload.get("date_column") or (profile_data["datetime_columns"][0] if profile_data["datetime_columns"] else None)
            target_col = target_column or (profile_data["numerical_columns"][0] if profile_data["numerical_columns"] else None)
            if not date_col or not target_col:
                raise HTTPException(400, "Dataset needs a datetime column and a numeric column to forecast")
            return ml_engine.run_forecast(df, date_col, target_col, payload.get("periods") or 30)
        raise HTTPException(400, f"Unknown task '{task}'")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Model run failed: {e}")


@app.get("/ai/{dataset_id}/insights", dependencies=[Depends(require_internal_key)])
async def ai_insights(dataset_id: str):
    df = _load_or_404(dataset_id)
    profile_data = dp.profile_dataframe(df)
    stats = dp.descriptive_statistics(df, profile_data["numerical_columns"])
    corr = dp.correlation_matrix(df, profile_data["numerical_columns"])
    outliers_data = dp.detect_outliers_iqr(df, profile_data["numerical_columns"])
    generated = ai_engine.generate_local_insights(profile_data, stats, corr, outliers_data)
    summary = ai_engine.generate_local_summary(profile_data, generated)
    return {"insights": generated, "summary": summary}

@app.post(
    "/analysis/root-cause",
    dependencies=[Depends(require_internal_key)],
)
async def root_cause_analysis(payload: dict):
    dataset_id = payload.get("dataset_id")
    date_column = payload.get("date_column")
    metric_column = payload.get("metric_column")
    dimension_columns = payload.get("dimension_columns", [])
    period = payload.get("period", "M")
    comparison_mode = payload.get("comparison_mode", "full")

    if not dataset_id:
        raise HTTPException(
            status_code=400,
            detail="dataset_id is required",
        )

    if not date_column:
        raise HTTPException(
            status_code=400,
            detail="date_column is required",
        )

    if not metric_column:
        raise HTTPException(
            status_code=400,
            detail="metric_column is required",
        )

    df = _load_or_404(dataset_id)

    try:
        result = root_cause_engine.analyze_period_change(
    df=df,
    date_column=date_column,
    metric_column=metric_column,
    dimension_columns=dimension_columns,
    period=period,
    comparison_mode=comparison_mode,
)

        return result

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Root cause analysis failed",
        )


@app.post("/chat/ask", dependencies=[Depends(require_internal_key)])
async def chat_ask(payload: dict):
    dataset_id = payload["dataset_id"]
    message = payload["message"]
    df = _load_or_404(dataset_id)
    profile_data = dp.profile_dataframe(df)
    return ai_engine.answer_chat_locally(message, df, profile_data)


@app.get("/reports/{dataset_id}/excel", dependencies=[Depends(require_internal_key)])
async def excel_report(dataset_id: str):
    df = _load_or_404(dataset_id)
    profile_data = dp.profile_dataframe(df)
    stats = dp.descriptive_statistics(df, profile_data["numerical_columns"])
    content = report_engine.build_excel_report(df, profile_data, stats)
    return StreamingResponse(io.BytesIO(content), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.get("/reports/{dataset_id}/pdf", dependencies=[Depends(require_internal_key)])
async def pdf_report(dataset_id: str, filename: str = "dataset"):
    df = _load_or_404(dataset_id)
    profile_data = dp.profile_dataframe(df)
    stats = dp.descriptive_statistics(df, profile_data["numerical_columns"])
    corr = dp.correlation_matrix(df, profile_data["numerical_columns"])
    outliers_data = dp.detect_outliers_iqr(df, profile_data["numerical_columns"])
    insights = ai_engine.generate_local_insights(profile_data, stats, corr, outliers_data)
    summary = ai_engine.generate_local_summary(profile_data, insights)
    content = report_engine.build_pdf_report(filename, profile_data, insights, summary)
    return StreamingResponse(io.BytesIO(content), media_type="application/pdf")


def _load_or_404(dataset_id: str, cleaned: bool = True):
    try:
        return dp.load_dataframe(dataset_id, cleaned=cleaned)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found")

@app.post(
    "/copilot/query",
    dependencies=[Depends(require_internal_key)],
)
async def copilot_query(payload: dict):
    dataset_id = payload.get("dataset_id")
    tool = payload.get("tool")
    arguments = payload.get("arguments", {})

    if not dataset_id:
        raise HTTPException(
            status_code=400,
            detail="dataset_id is required",
        )

    if not tool:
        raise HTTPException(
            status_code=400,
            detail="tool is required",
        )

    if not isinstance(arguments, dict):
        raise HTTPException(
            status_code=400,
            detail="arguments must be an object",
        )

    df = _load_or_404(dataset_id)

    try:
        return copilot_engine.execute_tool(
            df=df,
            tool=tool,
            arguments=arguments,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except Exception as exc:
        print(
            "[COPILOT ERROR]",
            type(exc).__name__,
            str(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Copilot analysis failed",
        )