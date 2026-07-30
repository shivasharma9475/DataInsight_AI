import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";

import {
  aiApi,
  datasetApi,
} from "../services/api.js";


// ============================================================
// Helpers
// ============================================================

function getColumnName(column) {
  if (typeof column === "string") {
    return column;
  }

  return column?.name || "";
}


function normalizeColumn(column) {
  if (typeof column === "string") {
    return {
      name: column,
      dtype: "",
    };
  }

  return {
    name: column?.name || "",
    dtype: column?.dtype || "",
  };
}


function formatType(type) {
  return String(type || "recommendation")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}


function getPriorityClasses(priority) {
  switch (priority) {
    case "high":
      return (
        "bg-red-500/10 text-red-300 " +
        "border-red-500/20"
      );

    case "medium":
      return (
        "bg-amber-500/10 text-amber-300 " +
        "border-amber-500/20"
      );

    default:
      return (
        "bg-emerald-500/10 text-emerald-300 " +
        "border-emerald-500/20"
      );
  }
}


function getTypeIcon(type) {
  switch (type) {
    case "anomaly_investigation":
      return AlertTriangle;

    case "concentration_risk":
      return ShieldAlert;

    case "growth_opportunity":
      return Target;

    case "decline_intervention":
      return BarChart3;

    case "data_quality":
      return CheckCircle2;

    default:
      return Lightbulb;
  }
}


// ============================================================
// Summary Card
// ============================================================

function SummaryCard({
  label,
  value,
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-2xl font-semibold text-slate-100">
        {value}
      </div>

      <div className="text-xs text-slate-500 mt-1">
        {label}
      </div>
    </div>
  );
}


// ============================================================
// Recommendation Card
// ============================================================

function RecommendationCard({
  recommendation,
}) {
  const Icon = getTypeIcon(
    recommendation.type
  );

  return (
    <article className="glass rounded-2xl p-5 border border-slate-800">
      {/* Header */}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-slate-800 shrink-0">
            <Icon
              size={19}
              className="text-brand-400"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={
                  "text-xs border rounded-full px-2.5 py-1 " +
                  getPriorityClasses(
                    recommendation.priority
                  )
                }
              >
                {recommendation.priority
                  ?.toUpperCase()}
              </span>

              <span className="text-xs text-slate-500">
                {formatType(
                  recommendation.type
                )}
              </span>
            </div>

            <h3 className="text-base font-semibold text-slate-100">
              {recommendation.title}
            </h3>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xl font-semibold text-slate-100">
            {recommendation.score}
          </div>

          <div className="text-xs text-slate-500">
            Score
          </div>
        </div>
      </div>

      {/* Reason */}

      <p className="mt-4 text-sm text-slate-400 leading-6">
        {recommendation.reason}
      </p>

      {/* Evidence */}

      {recommendation.evidence && (
        <div className="mt-4 bg-slate-900/60 rounded-xl p-3">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
            Evidence
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(
              recommendation.evidence
            ).map(([key, value]) => {
              const displayValue =
                Array.isArray(value)
                  ? value.join(", ")
                  : String(value);

              return (
                <div
                  key={key}
                  className="text-xs bg-slate-800 rounded-lg px-2.5 py-1.5"
                >
                  <span className="text-slate-500">
                    {formatType(key)}:
                  </span>{" "}
                  <span className="text-slate-300">
                    {displayValue}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}

      {recommendation.actions?.length >
        0 && (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">
            Recommended Actions
          </div>

          <div className="space-y-2">
            {recommendation.actions.map(
              (action, index) => (
                <div
                  key={`${index}-${action}`}
                  className="flex items-start gap-2 text-sm text-slate-300"
                >
                  <CheckCircle2
                    size={15}
                    className="text-emerald-400 mt-0.5 shrink-0"
                  />

                  <span>
                    {action}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </article>
  );
}


// ============================================================
// Recommendations Page
// ============================================================

export default function Recommendations() {
  const { datasetId } = useParams();

  const [profile, setProfile] =
    useState(null);

  const [metric, setMetric] =
    useState("");

  const [dimensions, setDimensions] =
    useState([]);

  const [result, setResult] =
    useState(null);

  const [
    loadingProfile,
    setLoadingProfile,
  ] = useState(true);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  // ==========================================================
  // Numerical columns
  // ==========================================================

  const numericalColumns =
    useMemo(() => {
      if (!profile) {
        return [];
      }

      // Preferred format from profile API
      if (
        Array.isArray(
          profile.numerical_columns
        ) &&
        profile.numerical_columns.length >
          0
      ) {
        return profile.numerical_columns
          .map(getColumnName)
          .filter(Boolean);
      }

      // Fallback: detect using dtype
      return (profile.columns || [])
        .map(normalizeColumn)
        .filter((column) => {
          const dtype =
            column.dtype.toLowerCase();

          return (
            dtype.includes("int") ||
            dtype.includes("float") ||
            dtype.includes("number")
          );
        })
        .map(
          (column) =>
            column.name
        )
        .filter(Boolean);
    }, [profile]);


  // ==========================================================
  // Dimension columns
  // ==========================================================

  const dimensionColumns =
    useMemo(() => {
      if (!profile) {
        return [];
      }

      const categorical = (
        profile.categorical_columns ||
        []
      )
        .map(getColumnName)
        .filter(Boolean);

      const datetime = (
        profile.datetime_columns ||
        []
      )
        .map(getColumnName)
        .filter(Boolean);

      const preferred = [
        ...categorical,
        ...datetime,
      ];

      if (preferred.length > 0) {
        return [
          ...new Set(preferred),
        ];
      }

      // Fallback:
      // all non-numeric columns
      return (profile.columns || [])
        .map(normalizeColumn)
        .map(
          (column) =>
            column.name
        )
        .filter(
          (name) =>
            name &&
            !numericalColumns.includes(
              name
            )
        );
    }, [
      profile,
      numericalColumns,
    ]);


  // ==========================================================
  // Load profile
  // ==========================================================

  useEffect(() => {
    if (!datasetId) {
      setLoadingProfile(false);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setLoadingProfile(true);
      setError("");

      try {
        const response =
          await datasetApi.profile(
            datasetId
          );

        if (!cancelled) {
          setProfile(
            response.data
          );
        }
      } catch (err) {
        console.error(
          "Failed to load profile:",
          err
        );

        if (!cancelled) {
          setError(
            err.response?.data
              ?.message ||
              err.response?.data
                ?.detail ||
              "Failed to load dataset profile."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(
            false
          );
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [datasetId]);


  // ==========================================================
  // Default metric
  // ==========================================================

  useEffect(() => {
    if (
      !metric &&
      numericalColumns.length > 0
    ) {
      setMetric(
        numericalColumns[0]
      );
    }
  }, [
    metric,
    numericalColumns,
  ]);


  // ==========================================================
  // Default dimension
  // ==========================================================

  useEffect(() => {
    if (
      dimensions.length === 0 &&
      dimensionColumns.length > 0
    ) {
      setDimensions([
        dimensionColumns[0],
      ]);
    }
  }, [
    dimensions.length,
    dimensionColumns,
  ]);


  // ==========================================================
  // Toggle dimension
  // ==========================================================

  const toggleDimension = (
    column
  ) => {
    setDimensions(
      (current) => {
        if (
          current.includes(column)
        ) {
          return current.filter(
            (item) =>
              item !== column
          );
        }

        if (
          current.length >= 10
        ) {
          return current;
        }

        return [
          ...current,
          column,
        ];
      }
    );
  };


  // ==========================================================
  // Generate Recommendations
  // ==========================================================

  const generateRecommendations =
    async () => {
      if (!datasetId) {
        setError(
          "Dataset ID is missing."
        );
        return;
      }

      if (!metric) {
        setError(
          "Please select a metric."
        );
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response =
          await aiApi.recommendations({
            dataset_id:
              datasetId,

            metric_column:
              metric,

            dimension_columns:
              dimensions,

            max_recommendations:
              20,
          });

        setResult(
          response.data
        );
      } catch (err) {
        console.error(
          "Recommendation request failed:",
          err
        );

        setError(
          err.response?.data
            ?.message ||
            err.response?.data
              ?.detail ||
            "Failed to generate recommendations."
        );
      } finally {
        setLoading(false);
      }
    };


  // ==========================================================
  // Loading
  // ==========================================================

  if (loadingProfile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2
            size={20}
            className="animate-spin"
          />

          Loading dataset...
        </div>
      </div>
    );
  }


  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles
              size={22}
              className="text-brand-400"
            />

            Recommendations
          </h1>

          <p className="text-slate-400 text-sm mt-1">
            Generate evidence-based recommendations from your dataset.
          </p>
        </div>

        {result && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Brain size={15} />

            {result.ai_enhanced
              ? "AI Enhanced"
              : "Deterministic Analysis"}
          </div>
        )}
      </div>


      {/* Configuration */}

      <section className="glass rounded-2xl p-5 mb-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Metric */}

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Metric
            </label>

            <select
              value={metric}
              onChange={(event) => {
                setMetric(
                  event.target.value
                );

                setResult(null);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="">
                Select a metric
              </option>

              {numericalColumns.map(
                (column) => (
                  <option
                    key={column}
                    value={column}
                  >
                    {column}
                  </option>
                )
              )}
            </select>

            {numericalColumns.length ===
              0 && (
              <p className="text-xs text-amber-400 mt-2">
                No numerical columns were detected in this dataset.
              </p>
            )}
          </div>


          {/* Dimensions */}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-200">
                Dimensions
              </label>

              <span className="text-xs text-slate-500">
                {dimensions.length}/10
              </span>
            </div>

            {dimensionColumns.length >
            0 ? (
              <div className="flex flex-wrap gap-2">
                {dimensionColumns.map(
                  (column) => {
                    const selected =
                      dimensions.includes(
                        column
                      );

                    return (
                      <button
                        key={column}
                        type="button"
                        onClick={() => {
                          toggleDimension(
                            column
                          );

                          setResult(
                            null
                          );
                        }}
                        className={
                          selected
                            ? "text-xs px-3 py-2 rounded-lg border bg-brand-600 border-brand-500 text-white transition"
                            : "text-xs px-3 py-2 rounded-lg border bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 transition"
                        }
                      >
                        {column}
                      </button>
                    );
                  }
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No categorical or datetime dimensions were detected.
              </p>
            )}
          </div>
        </div>


        {/* Generate button */}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={
              generateRecommendations
            }
            disabled={
              loading ||
              !metric
            }
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl text-sm font-medium transition"
          >
            {loading ? (
              <>
                <Loader2
                  size={16}
                  className="animate-spin"
                />

                Analyzing...
              </>
            ) : result ? (
              <>
                <RefreshCw
                  size={16}
                />

                Run Again
              </>
            ) : (
              <>
                <Sparkles
                  size={16}
                />

                Generate Recommendations
              </>
            )}
          </button>
        </div>
      </section>


      {/* Error */}

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-start gap-2 text-sm text-red-300">
            <AlertTriangle
              size={17}
              className="mt-0.5 shrink-0"
            />

            <span>
              {error}
            </span>
          </div>
        </div>
      )}


      {/* Initial state */}

      {!result &&
        !loading &&
        !error && (
          <section className="glass rounded-2xl min-h-[300px] flex flex-col items-center justify-center text-center p-8">
            <div className="p-3 bg-brand-500/10 rounded-2xl mb-4">
              <Lightbulb
                size={30}
                className="text-brand-400"
              />
            </div>

            <h2 className="text-slate-200 font-medium">
              Find opportunities in your data
            </h2>

            <p className="text-sm text-slate-500 mt-2 max-w-md">
              Select a metric and one or more dimensions, then run the recommendation engine.
            </p>
          </section>
        )}


      {/* Results */}

      {result && (
        <>
          {/* Summary */}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <SummaryCard
              label="Recommendations"
              value={
                result.summary
                  ?.total ?? 0
              }
            />

            <SummaryCard
              label="High Priority"
              value={
                result.summary
                  ?.high_priority ??
                0
              }
            />

            <SummaryCard
              label="Medium Priority"
              value={
                result.summary
                  ?.medium_priority ??
                0
              }
            />

            <SummaryCard
              label="Low Priority"
              value={
                result.summary
                  ?.low_priority ??
                0
              }
            />
          </div>


          {/* AI Explanation */}

          {result.ai_explanation && (
            <section className="glass rounded-2xl p-5 mb-6 border border-brand-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Brain
                  size={18}
                  className="text-brand-400"
                />

                <h2 className="font-medium text-slate-100">
                  AI Explanation
                </h2>
              </div>

              <p className="text-sm text-slate-300 leading-6 whitespace-pre-line">
                {
                  result.ai_explanation
                }
              </p>
            </section>
          )}


          {/* Recommendation Cards */}

          {result.recommendations
            ?.length > 0 ? (
            <div className="grid lg:grid-cols-2 gap-4">
              {result.recommendations.map(
                (
                  recommendation,
                  index
                ) => (
                  <RecommendationCard
                    key={`${recommendation.type}-${index}`}
                    recommendation={
                      recommendation
                    }
                  />
                )
              )}
            </div>
          ) : (
            <section className="glass rounded-2xl p-8 text-center">
              <CheckCircle2
                size={30}
                className="text-emerald-400 mx-auto mb-3"
              />

              <h2 className="text-slate-200 font-medium">
                No major recommendations detected
              </h2>

              <p className="text-sm text-slate-500 mt-2 max-w-lg mx-auto">
                The selected metric and dimensions did not cross the configured recommendation thresholds.
              </p>
            </section>
          )}


          {/* Analysis metadata */}

          <section className="mt-6 border-t border-slate-800 pt-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
              <span>
                Engine:{" "}
                {result.engine ||
                  result
                    .analysis_quality
                    ?.engine ||
                  "—"}
              </span>

              <span>
                Rows analyzed:{" "}
                {result
                  .analysis_quality
                  ?.rows_analyzed ??
                  "—"}
              </span>

              <span>
                Valid metric rows:{" "}
                {result
                  .analysis_quality
                  ?.valid_metric_rows ??
                  "—"}
              </span>

              <span>
                AI enhanced:{" "}
                {result.ai_enhanced
                  ? "Yes"
                  : "No"}
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}