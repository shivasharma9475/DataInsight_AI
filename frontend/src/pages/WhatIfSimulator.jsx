import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

import { datasetApi, whatIfApi } from "../services/api.js";

export default function WhatIfSimulator() {
  const { datasetId } = useParams();

  const [profile, setProfile] = useState(null);
  const [preview, setPreview] = useState(null);

  const [metricColumn, setMetricColumn] = useState("");
  const [dimensionColumn, setDimensionColumn] = useState("");
  const [segmentValue, setSegmentValue] = useState("");
  const [changePercentage, setChangePercentage] = useState(10);

  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // ---------------------------------------------------------
  // Load dataset profile + preview
  // ---------------------------------------------------------

  useEffect(() => {
    if (!datasetId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const [profileRes, previewRes] =
          await Promise.all([
            datasetApi.profile(datasetId),
            datasetApi.preview(datasetId, 500),
          ]);

        const profileData = profileRes.data;

        setProfile(profileData);
        setPreview(previewRes.data);

        const numeric =
          profileData?.numerical_columns || [];

        const categorical =
          profileData?.categorical_columns || [];

        if (numeric.length > 0) {
          setMetricColumn(numeric[0]);
        }

        if (categorical.length > 0) {
          setDimensionColumn(categorical[0]);
        }
      } catch (err) {
        console.error(
          "Failed to load What-if data:",
          err
        );

        setError(
          err.response?.data?.message ||
            "Failed to load dataset information."
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [datasetId]);

  // ---------------------------------------------------------
  // Available columns
  // ---------------------------------------------------------

  const numericalColumns = useMemo(
    () => profile?.numerical_columns || [],
    [profile]
  );

  const categoricalColumns = useMemo(
    () => profile?.categorical_columns || [],
    [profile]
  );

  // ---------------------------------------------------------
  // Segment values
  // ---------------------------------------------------------

  const segmentValues = useMemo(() => {
    if (!dimensionColumn || !preview?.rows) {
      return [];
    }

    const columnIndex =
      preview.columns?.indexOf(
        dimensionColumn
      );

    if (
      columnIndex === undefined ||
      columnIndex === -1
    ) {
      return [];
    }

    const values = preview.rows
      .map((row) => row[columnIndex])
      .filter(
        (value) =>
          value !== null &&
          value !== undefined &&
          String(value).trim() !== ""
      );

    return [...new Set(values.map(String))].sort();
  }, [dimensionColumn, preview]);

  // ---------------------------------------------------------
  // Reset segment when dimension changes
  // ---------------------------------------------------------

  useEffect(() => {
    setSegmentValue("");
    setResult(null);
  }, [dimensionColumn]);

  // ---------------------------------------------------------
  // Run simulation
  // ---------------------------------------------------------

  const simulate = async (e) => {
    e?.preventDefault();

    setError("");
    setResult(null);

    if (!datasetId) {
      setError("Dataset ID is missing.");
      return;
    }

    if (!metricColumn) {
      setError("Please select a metric.");
      return;
    }

    if (
      changePercentage === "" ||
      Number.isNaN(
        Number(changePercentage)
      )
    ) {
      setError(
        "Please enter a valid percentage."
      );
      return;
    }

    if (
      dimensionColumn &&
      !segmentValue
    ) {
      setError(
        "Please select a segment."
      );
      return;
    }

    try {
      setSimulating(true);

      const response =
        await whatIfApi.simulate({
          dataset_id: datasetId,

          metric_column: metricColumn,

          dimension_column:
            dimensionColumn || null,

          segment_value:
            dimensionColumn
              ? segmentValue
              : null,

          change_percentage:
            Number(changePercentage),
        });

      setResult(
        response.data?.result ||
          response.data
      );
    } catch (err) {
      console.error(
        "What-if simulation failed:",
        err
      );

      setError(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          "What-if simulation failed."
      );
    } finally {
      setSimulating(false);
    }
  };

  // ---------------------------------------------------------
  // Reset
  // ---------------------------------------------------------

  const reset = () => {
    setResult(null);
    setError("");
    setChangePercentage(10);

    if (numericalColumns.length > 0) {
      setMetricColumn(
        numericalColumns[0]
      );
    }

    if (categoricalColumns.length > 0) {
      setDimensionColumn(
        categoricalColumns[0]
      );
    } else {
      setDimensionColumn("");
    }

    setSegmentValue("");
  };

  // ---------------------------------------------------------
  // Loading
  // ---------------------------------------------------------

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass rounded-2xl p-8 text-center text-slate-400">
          Loading What-if Simulator...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center">
            <Calculator
              size={21}
              className="text-brand-400"
            />
          </div>

          <div>
            <h1 className="text-2xl font-semibold">
              What-if Simulator
            </h1>

            <p className="text-sm text-slate-400">
              Explore how changing a metric or
              segment could affect your results.
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      {/* Simulator */}
      <div className="glass rounded-2xl p-6">

        <form
          onSubmit={simulate}
          className="space-y-6"
        >

          {/* Metric */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Metric
            </label>

            <select
              value={metricColumn}
              onChange={(e) => {
                setMetricColumn(
                  e.target.value
                );
                setResult(null);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
            >
              {numericalColumns.length === 0 && (
                <option value="">
                  No numeric columns available
                </option>
              )}

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
          </div>

          {/* Dimension */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Dimension
              <span className="text-slate-500 ml-2">
                Optional
              </span>
            </label>

            <select
              value={dimensionColumn}
              onChange={(e) =>
                setDimensionColumn(
                  e.target.value
                )
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
            >
              <option value="">
                Entire metric
              </option>

              {categoricalColumns.map(
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
          </div>

          {/* Segment */}
          {dimensionColumn && (
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Segment
              </label>

              <select
                value={segmentValue}
                onChange={(e) =>
                  setSegmentValue(
                    e.target.value
                  )
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
              >
                <option value="">
                  Select segment
                </option>

                {segmentValues.map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {value}
                    </option>
                  )
                )}
              </select>
            </div>
          )}

          {/* Percentage */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Change Percentage
            </label>

            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                value={changePercentage}
                onChange={(e) =>
                  setChangePercentage(
                    e.target.value
                  )
                }
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
                placeholder="e.g. 15"
              />

              <span className="text-slate-400">
                %
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Use a positive value for increase
              and a negative value for decrease.
            </p>
          </div>

          {/* Quick scenarios */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Quick scenarios
            </label>

            <div className="flex flex-wrap gap-2">
              {[10, 15, 20, -10, -15, -20].map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setChangePercentage(
                        value
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                  >
                    {value > 0 ? "+" : ""}
                    {value}%
                  </button>
                )
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={simulating}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 transition rounded-xl px-4 py-3 text-sm font-medium"
            >
              <Calculator size={17} />

              {simulating
                ? "Simulating..."
                : "Run Simulation"}
            </button>

            <button
              type="button"
              onClick={reset}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition"
              title="Reset"
            >
              <RotateCcw size={17} />
            </button>
          </div>
        </form>
      </div>

      {/* Result */}
      {result && (
        <div className="glass rounded-2xl p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">
                Simulation Result
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                Deterministic scenario analysis
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 size={16} />
              Verified calculation
            </div>
          </div>

          {/* Main comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <MetricCard
              label="Baseline Total"
              value={result.baseline_total}
            />

            <div className="flex items-center justify-center">
              <ArrowRight
                className="hidden md:block text-slate-600"
                size={24}
              />
            </div>

            <MetricCard
              label="Projected Total"
              value={result.projected_total}
              highlight
            />

          </div>

          {/* Impact */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">

            <ImpactCard
              label="Absolute Impact"
              value={result.absolute_impact}
            />

            <ImpactCard
              label="Total Impact"
              value={result.percentage_impact}
              percentage
            />

            {result.baseline_segment !==
              undefined && (
              <MetricCard
                label="Baseline Segment"
                value={
                  result.baseline_segment
                }
              />
            )}

          </div>

          {/* Scenario */}
          <div className="mt-6 rounded-xl bg-slate-900/70 border border-slate-800 p-4">

            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Scenario
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">

              <Info
                label="Metric"
                value={
                  result.metric_column
                }
              />

              <Info
                label="Dimension"
                value={
                  result.dimension_column ||
                  "Entire metric"
                }
              />

              <Info
                label="Segment"
                value={
                  result.segment_value ||
                  "All"
                }
              />

              <Info
                label="Change"
                value={`${
                  result.change_percentage > 0
                    ? "+"
                    : ""
                }${result.change_percentage}%`}
              />

            </div>
          </div>

          {/* Segment projection */}
          {result.projected_segment !==
            undefined && (
            <div className="mt-4 rounded-xl bg-slate-900/70 border border-slate-800 p-4">

              <div className="flex items-center gap-2 mb-3">
                {result.change_percentage >=
                0 ? (
                  <TrendingUp
                    size={17}
                    className="text-emerald-400"
                  />
                ) : (
                  <TrendingDown
                    size={17}
                    className="text-red-400"
                  />
                )}

                <h3 className="text-sm font-medium">
                  Segment Impact
                </h3>
              </div>

              <div className="flex items-center gap-4 text-sm">

                <span className="text-slate-400">
                  {formatNumber(
                    result.baseline_segment
                  )}
                </span>

                <ArrowRight
                  size={16}
                  className="text-slate-600"
                />

                <span className="font-semibold text-slate-100">
                  {formatNumber(
                    result.projected_segment
                  )}
                </span>

                <span
                  className={
                    result.change_percentage >=
                    0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }
                >
                  {result.change_percentage > 0
                    ? "+"
                    : ""}
                  {result.change_percentage}%
                </span>

              </div>
            </div>
          )}

          {/* Assumptions */}
          {result.assumptions?.length > 0 && (
            <div className="mt-5">

              <h3 className="text-sm font-medium text-slate-300 mb-2">
                Assumptions
              </h3>

              <ul className="space-y-1.5">
                {result.assumptions.map(
                  (assumption, index) => (
                    <li
                      key={index}
                      className="text-xs text-slate-500 flex gap-2"
                    >
                      <span>•</span>
                      {assumption}
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          {/* Engine */}
          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Engine
            </span>

            <span className="text-slate-300">
              {result.engine ||
                "deterministic_v1"}
            </span>
          </div>

        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------
// Helper Components
// ---------------------------------------------------------

function MetricCard({
  label,
  value,
  highlight = false,
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight
          ? "border-brand-500/30 bg-brand-500/10"
          : "border-slate-800 bg-slate-900/50"
      }`}
    >
      <p className="text-xs text-slate-500 mb-2">
        {label}
      </p>

      <p className="text-xl font-semibold">
        {formatNumber(value)}
      </p>
    </div>
  );
}


function ImpactCard({
  label,
  value,
  percentage = false,
}) {
  const positive = Number(value) >= 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">

      <p className="text-xs text-slate-500 mb-2">
        {label}
      </p>

      <p
        className={`text-lg font-semibold ${
          positive
            ? "text-emerald-400"
            : "text-red-400"
        }`}
      >
        {positive ? "+" : ""}
        {percentage
          ? `${Number(value).toFixed(2)}%`
          : formatNumber(value)}
      </p>

    </div>
  );
}


function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="text-sm text-slate-200 mt-1 truncate">
        {String(value)}
      </p>
    </div>
  );
}


function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}