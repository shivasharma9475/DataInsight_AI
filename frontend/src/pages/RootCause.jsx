import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { SearchCode, Loader2, AlertCircle } from "lucide-react";
import { datasetApi, rcaApi } from "../services/api.js";
import { Skeleton } from "../components/UI.jsx";
import RootCauseConfig from "../components/rca/RootCauseConfig.jsx";
import MetricChangeSummary from "../components/rca/MetricChangeSummary.jsx";
import ContributorList from "../components/rca/ContributorList.jsx";
import ContributionChart from "../components/rca/ContributionChart.jsx";
import DimensionBreakdown from "../components/rca/DimensionBreakdown.jsx";
import EvidencePanel from "../components/rca/EvidencePanel.jsx";
import AnalysisEmptyState from "../components/rca/AnalysisEmptyState.jsx";
import { MAX_DIMENSIONS } from "../utils/formatMetric.js";

function mapErrorToMessage(err) {
  if (!err.response) {
    return "Network error. Check your connection and try again.";
  }
  const { status, data } = err.response;
  const backendDetail = data?.detail || data?.message;

  if (status === 400) {
    if (backendDetail && /period/i.test(backendDetail)) {
      return { preset: "insufficient-periods" };
    }
    return backendDetail || "This configuration isn't valid for the selected dataset. Please review your choices.";
  }
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403) return "You don't have access to this dataset.";
  if (status === 404) return "This dataset could not be found.";
  if (status === 429) return "Too many requests right now. Please wait a moment and try again.";
  if (status >= 500) return "Something went wrong while analyzing this dataset. Please try again.";
  return backendDetail || "Something went wrong. Please try again.";
}

export default function RootCause() {
  const { datasetId } = useParams();
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");

  const [metricColumn, setMetricColumn] = useState("");
  const [dateColumn, setDateColumn] = useState("");
  const [period, setPeriod] = useState("M");
  const [comparisonMode, setComparisonMode] = useState("comparable");
  const [dimensionColumns, setDimensionColumns] = useState([]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null); // string | { preset } | null

  useEffect(() => {
    let cancelled = false;
    datasetApi
      .profile(datasetId)
      .then((r) => {
        if (cancelled) return;
        const p = r.data;
        setProfile(p);
        // Smart defaults - never hard-coded column names, derived from this dataset's own schema.
        if (p.datetime_columns?.length) setDateColumn(p.datetime_columns[0]);
        if (p.numerical_columns?.length) setMetricColumn(p.numerical_columns[0]);
        if (p.categorical_columns?.length) {
          setDimensionColumns(p.categorical_columns.slice(0, Math.min(2, MAX_DIMENSIONS)));
        }
      })
      .catch(() => {
        if (!cancelled) setProfileError("Couldn't load this dataset's schema. Please refresh and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const toggleDimension = (col) => {
    setDimensionColumns((prev) => {
      if (prev.includes(col)) return prev.filter((c) => c !== col);
      if (prev.length >= MAX_DIMENSIONS) return prev;
      return [...prev, col];
    });
  };

 const runAnalysis = async () => {
  if (loading) return;

  setLoading(true);
  setError(null);
  setResult(null);

  const payload = {
    dataset_id: datasetId,
    date_column: dateColumn,
    metric_column: metricColumn,
    dimension_columns: dimensionColumns,
    period,
    comparison_mode: comparisonMode,
  };

  try {
    const { data } = await rcaApi.analyze(payload);
    setResult(data);
  } catch (err) {
    setError(mapErrorToMessage(err));
  } finally {
    setLoading(false);
  }
};

  // Presentation-only aggregation across already-computed per-dimension contributors,
  // used only when the backend's top_contributors list is empty. Does not recompute
  // any contribution values - just re-sorts/merges what the backend already returned.
  const topContributors = useMemo(() => {
    if (!result) return [];
    if (result.top_contributors?.length) return result.top_contributors;
    const merged = (result.dimensions || []).flatMap((d) => d.contributors || []);
    return [...merged].sort((a, b) => (b.contribution_pct ?? 0) - (a.contribution_pct ?? 0)).slice(0, 5);
  }, [result]);

  if (profileError) {
    return <AnalysisEmptyState title="Couldn't load dataset" desc={profileError} icon={AlertCircle} />;
  }

  if (!profile) {
    return (
      <div className="max-w-6xl mx-auto pb-16 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Skeleton className="h-96 rounded-2xl" />
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const noDate = !profile.datetime_columns?.length;
  const noMetric = !profile.numerical_columns?.length;
  const noDimensions = !profile.categorical_columns?.length;

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <SearchCode className="text-brand-400" size={22} />
          Root Cause Analysis
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Understand why {metricColumn || "a metric"} changed, and which segments contributed most.
        </p>
      </div>

      {noDate ? (
        <AnalysisEmptyState preset="no-date" />
      ) : noMetric ? (
        <AnalysisEmptyState preset="no-metric" />
      ) : noDimensions ? (
        <AnalysisEmptyState preset="no-dimensions" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-1">
            <RootCauseConfig
              profile={profile}
              metricColumn={metricColumn}
              dateColumn={dateColumn}
              period={period}
              dimensionColumns={dimensionColumns}
              onChangeMetric={setMetricColumn}
              onChangeDate={setDateColumn}
              onChangePeriod={setPeriod}
              onToggleDimension={toggleDimension}
              onAnalyze={runAnalysis}
              loading={loading}
            />
          </div>

          <div className="md:col-span-2 space-y-5">
            {loading && (
              <div className="flex items-center gap-3 bg-slate-900/60 rounded-2xl p-5 text-sm text-slate-300">
                <Loader2 size={18} className="animate-spin text-brand-400" />
                Analyzing metric changes and contributors…
              </div>
            )}

            {!loading && error && (
              typeof error === "object" && error.preset ? (
                <AnalysisEmptyState preset={error.preset} />
              ) : (
                <div className="flex items-start gap-2 bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-xl">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )
            )}

            {!loading && !error && !result && (
              <AnalysisEmptyState
                icon={SearchCode}
                title="Ready to analyze"
                desc="Choose your metric, date column, period, and dimensions, then click Analyze Causes to see what changed and why."
              />
            )}

            

            {!loading && result && (
              <>
              {result.analysis_quality?.warning && (
  <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
    <AlertCircle
      size={18}
      className="mt-0.5 shrink-0 text-amber-400"
    />

    <div>
      <p className="text-sm font-medium text-amber-300">
        Comparable period analysis
      </p>

      <p className="mt-1 text-sm text-amber-200/80">
        {result.analysis_quality.warning}
      </p>
    </div>
  </div>
)}
                <MetricChangeSummary metric={result.metric} comparison={result.comparison} />

                <div>
                  <h2 className="text-lg font-semibold text-slate-200 mb-3">Top Contributors</h2>
                  <ContributorList contributors={topContributors} metric={result.metric} />
                </div>

                {topContributors.length > 0 && (
                  <ContributionChart contributors={topContributors} metric={result.metric} />
                )}

                <DimensionBreakdown dimensions={result.dimensions} metric={result.metric} />

                <EvidencePanel comparison={result.comparison} dimensions={result.dimensions} metric={result.metric} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
