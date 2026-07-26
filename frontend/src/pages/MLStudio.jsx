import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Brain, Play, Loader2, TrendingUp, Layers, Target, GitBranch } from "lucide-react";
import { datasetApi, mlApi } from "../services/api.js";
import { Card, Skeleton } from "../components/UI.jsx";
import { ScatterChartCard, TrendLineChart } from "../components/Charts.jsx";

const TASKS = [
  { id: "classification", label: "Classification", icon: Target, desc: "Predict a category" },
  { id: "regression", label: "Regression", icon: TrendingUp, desc: "Predict a number" },
  { id: "clustering", label: "Clustering", icon: Layers, desc: "Find natural groups" },
  { id: "forecasting", label: "Forecasting", icon: GitBranch, desc: "Project a trend forward" },
];

export default function MLStudio() {
  const { datasetId } = useParams();
  const [profile, setProfile] = useState(null);
  const [task, setTask] = useState(null);
  const [target, setTarget] = useState("");
  const [dateColumn, setDateColumn] = useState("");
  const [periods, setPeriods] = useState(30);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    datasetApi.profile(datasetId).then((r) => {
      setProfile(r.data);
      if (r.data.datetime_columns.length) setDateColumn(r.data.datetime_columns[0]);
    });
    mlApi.recommend(datasetId).then((r) => setRecommendation(r.data));
  }, [datasetId]);

  const runModel = async () => {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const payload = { dataset_id: datasetId, task };
      if (task === "classification" || task === "regression") payload.target_column = target;
      if (task === "forecasting") {
        payload.date_column = dateColumn;
        payload.target_column = target;
        payload.periods = Number(periods);
      }
      const res = await mlApi.run(payload);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Model run failed.");
    } finally {
      setRunning(false);
    }
  };

  if (!profile) {
    return <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;
  }

  const numTargets = task === "regression" || task === "forecasting" ? profile.numerical_columns : [...profile.categorical_columns, ...profile.numerical_columns];

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2"><Brain className="text-brand-400" size={22} /> ML Studio</h1>
      <p className="text-slate-400 text-sm mb-6">No-code machine learning. Pick a task, choose a target, run the model.</p>

      {recommendation?.suggestions?.length > 0 && (
        <div className="glass rounded-xl p-4 mb-6 text-sm text-slate-300">
          <span className="text-brand-400 font-medium">Recommended: </span>
          {recommendation.suggestions[0].reason}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {TASKS.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => { setTask(id); setResult(null); setError(""); }}
            className={`glass rounded-xl p-4 text-left transition ${task === id ? "ring-2 ring-brand-500" : "hover:bg-slate-800/40"}`}
          >
            <Icon size={18} className="text-brand-400 mb-2" />
            <div className="text-sm font-medium text-slate-200">{label}</div>
            <div className="text-xs text-slate-500">{desc}</div>
          </button>
        ))}
      </div>

      {task && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-end gap-4">
            {(task === "classification" || task === "regression") && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Target column</label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select column</option>
                  {numTargets.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {task === "forecasting" && (
              <>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Date column</label>
                  <select value={dateColumn} onChange={(e) => setDateColumn(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm">
                    {profile.datetime_columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Metric to forecast</label>
                  <select value={target} onChange={(e) => setTarget(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select column</option>
                    {profile.numerical_columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Periods ahead</label>
                  <input type="number" value={periods} onChange={(e) => setPeriods(e.target.value)} min={1} max={365}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm w-24" />
                </div>
              </>
            )}
            <button
              onClick={runModel}
              disabled={running || ((task === "classification" || task === "regression") && !target) || (task === "forecasting" && (!target || !dateColumn))}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 transition px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {running ? "Running..." : "Run model"}
            </button>
          </div>
        </Card>
      )}

      {error && <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-lg mb-6">{error}</div>}

      {result && (
        <div className="space-y-5">
          {(result.task === "classification" || result.task === "regression") && (
            <Card title={`Best model: ${result.best_model}`}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {Object.entries(result.models_tried).map(([name, metrics]) => (
                  <div key={name} className={`bg-slate-900/60 rounded-xl p-3 ${name === result.best_model ? "ring-1 ring-brand-500" : ""}`}>
                    <div className="text-xs text-slate-400 mb-1">{name.replace(/_/g, " ")}</div>
                    {Object.entries(metrics).map(([k, v]) => (
                      <div key={k} className="text-xs text-slate-500 flex justify-between"><span>{k}</span><span className="text-slate-300">{v}</span></div>
                    ))}
                  </div>
                ))}
              </div>
              {result.feature_importance && (
                <div>
                  <div className="text-xs text-slate-400 mb-2">Feature importance</div>
                  <div className="space-y-1">
                    {Object.entries(result.feature_importance)
                      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                      .map(([f, v]) => (
                        <div key={f} className="flex items-center gap-2 text-xs">
                          <div className="w-28 text-slate-400 truncate">{f}</div>
                          <div className="flex-1 bg-slate-800 rounded-full h-2">
                            <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${Math.min(Math.abs(v) * 100, 100)}%` }} />
                          </div>
                          <div className="w-12 text-right text-slate-500">{v}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {result.task === "regression" && result.actual_vs_predicted && (
            <ScatterChartCard
              title="Actual vs Predicted"
              x={result.actual_vs_predicted.actual}
              y={result.actual_vs_predicted.predicted}
              xLabel="Actual" yLabel="Predicted"
            />
          )}

          {result.task === "clustering" && (
            <>
              <Card title={`${result.algorithm} — ${result.n_clusters_found} clusters found`}>
                <div className="text-sm text-slate-400 mb-3">
                  Silhouette score: {result.silhouette_score ?? "N/A"} (closer to 1 = better separated clusters)
                </div>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(result.cluster_sizes).map(([c, n]) => (
                    <span key={c} className="text-xs bg-slate-800 px-2 py-1 rounded-full text-slate-300">Cluster {c}: {n}</span>
                  ))}
                </div>
              </Card>
              <ScatterChartCard title="Cluster visualization" x={result.points.x} y={result.points.y} clusters={result.points.cluster} />
            </>
          )}

          {result.task === "forecasting" && (
            <>
              <Card title={`${result.method} — trend is ${result.trend_direction} (${result.pct_change_projected}% projected change)`}>
                <TrendLineChart
                  title={null}
                  x={result.history.x} y={result.history.y}
                  forecastX={result.forecast.x} forecastY={result.forecast.y}
                />
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
