import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Database, AlertTriangle, Copy, Percent, Sparkles, Wand2, Loader2 } from "lucide-react";
import { datasetApi, aiApi } from "../services/api.js";
import { KPICard, Card, Skeleton } from "../components/UI.jsx";
import {
  HistogramChart, BarCategoryChart, TrendLineChart, ScatterChartCard,
  CorrelationHeatmap, BoxPlotSummary,
} from "../components/Charts.jsx";

export default function Dashboard() {
  const { datasetId } = useParams();
  const [profile, setProfile] = useState(null);
  const [eda, setEda] = useState(null);
  const [outliers, setOutliers] = useState(null);
  const [charts, setCharts] = useState(null);
  const [insights, setInsights] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanLog, setCleanLog] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    const [p, e, o, c] = await Promise.all([
      datasetApi.profile(datasetId),
      datasetApi.eda(datasetId),
      datasetApi.outliers(datasetId),
      datasetApi.charts(datasetId),
    ]);
    setProfile(p.data);
    setEda(e.data);
    setOutliers(o.data);
    setCharts(c.data);
    setLoading(false);
    aiApi.insights(datasetId).then((r) => setInsights(r.data)).catch(() => {});
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  const handleClean = async () => {
    setCleaning(true);
    try {
      const res = await datasetApi.clean({ dataset_id: datasetId, drop_duplicates: true, missing_strategy: "auto" });
      setCleanLog(res.data.log);
      await loadAll();
    } finally {
      setCleaning(false);
    }
  };

 

  if (loading || !profile) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    );
  }

  const outlierTotal = Object.values(outliers || {}).reduce((s, o) => s + o.count, 0);

  return (
    <div className="max-w-7xl mx-auto pb-16">
     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
  <div>
    <h1 className="text-2xl font-semibold">Dashboard</h1>
    <p className="text-slate-400 text-sm">
      Automated overview of your dataset.
    </p>
  </div>

  <div className="flex items-center gap-2 self-start">
    <button
      onClick={handleClean}
      disabled={cleaning}
      className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 transition px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
    >
      {cleaning ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Wand2 size={16} />
      )}

      {cleaning ? "Cleaning..." : "Auto-clean dataset"}
    </button>
  </div>
</div>

      {cleanLog && (
        <div className="bg-emerald-500/10 text-emerald-300 text-sm px-4 py-3 rounded-xl mb-6">
          Cleaned: {cleanLog.steps.join(" • ") || "No changes needed"}. Rows {cleanLog.rows_before} → {cleanLog.rows_after}.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPICard
  label="Rows"
  value={profile.row_count.toLocaleString()}
  icon={Database}
/>

<KPICard
  label="Columns"
  value={profile.column_count}
/>

<KPICard
  label="Missing Cells"
  value={`${profile.missing_pct}%`}
  sub={`${profile.missing_cells.toLocaleString()} cells`}
  tone={profile.missing_pct > 5 ? "warn" : "good"}
/>

<KPICard
  label="Duplicate Rows"
  value={profile.duplicate_count}
  tone={profile.duplicate_count > 0 ? "warn" : "good"}
/>
      </div>

      {/* AI Insights */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-400" /> AI Insights
            {insights?.ai_enhanced && <span className="text-[10px] bg-brand-600/30 text-brand-300 px-1.5 py-0.5 rounded">OpenAI-enhanced</span>}
          </span>
        }
        className="mb-8"
      >
        {!insights ? (
          <Skeleton className="h-20" />
        ) : (
          <>
            <p className="text-sm text-slate-300 mb-4">{insights.summary}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.insights.map((ins, i) => (
                <div key={i} className="bg-slate-900/60 rounded-xl p-3">
                  <div className="text-sm font-medium text-slate-200">{ins.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{ins.detail}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Column profile table */}
      <Card title="Column Profile" className="mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 text-xs uppercase">
                <th className="py-2 pr-4">Column</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Missing</th>
                <th className="py-2 pr-4">Unique</th>
                <th className="py-2 pr-4">Sample values</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {profile.columns.map((c) => (
                <tr key={c.name}>
                  <td className="py-2 pr-4 font-medium text-slate-200">{c.name}</td>
                  <td className="py-2 pr-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{c.inferred_type}</span>
                  </td>
                  <td className={`py-2 pr-4 ${c.missing_pct > 0 ? "text-amber-400" : "text-slate-500"}`}>{c.missing_pct}%</td>
                  <td className="py-2 pr-4 text-slate-400">{c.unique_count}</td>
                  <td className="py-2 pr-4 text-slate-500 truncate max-w-xs">{c.sample_values.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Outliers */}
      {outlierTotal > 0 && (
        <Card title={<span className="flex items-center gap-2"><AlertTriangle size={16} className="text-amber-400" /> Outliers</span>} className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(outliers).filter(([, o]) => o.count > 0).map(([col, o]) => (
              <div key={col} className="bg-slate-900/60 rounded-xl p-3">
                <div className="text-sm font-medium text-slate-200">{col}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {o.count} outliers ({o.pct}%) outside [{o.lower_bound}, {o.upper_bound}]
                </div>
                <div className="text-xs text-brand-400 mt-1">{o.treatment_suggestion}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Charts */}
      <h2 className="text-lg font-semibold mb-4">Visualizations</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {charts?.line && (
          <TrendLineChart title={`${charts.line.y_label} over time`} x={charts.line.x} y={charts.line.y} />
        )}
        {charts?.scatter && (
          <ScatterChartCard
            title={`${charts.scatter.x_label} vs ${charts.scatter.y_label}`}
            x={charts.scatter.x} y={charts.scatter.y}
            xLabel={charts.scatter.x_label} yLabel={charts.scatter.y_label}
          />
        )}
        {Object.entries(charts?.histograms || {}).map(([col, h]) => (
          <HistogramChart key={col} title={`Distribution of ${col}`} bins={h.bins} counts={h.counts} />
        ))}
        {Object.entries(charts?.bar || {}).map(([col, b]) => (
          <BarCategoryChart key={col} title={`${col} breakdown`} labels={b.labels} values={b.values} />
        ))}
      </div>

      {eda?.correlation?.matrix?.length > 0 && (
        <div className="mb-8">
          <CorrelationHeatmap columns={eda.correlation.columns} matrix={eda.correlation.matrix} />
        </div>
      )}

      {Object.keys(charts?.box || {}).length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-4">Box Plot Summaries</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Object.entries(charts.box).map(([col, s]) => (
              <BoxPlotSummary key={col} title={col} stats={s} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
