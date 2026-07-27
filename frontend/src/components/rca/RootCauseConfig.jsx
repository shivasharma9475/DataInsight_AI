import React from "react";
import { Loader2, Search, Check } from "lucide-react";
import { Card } from "../UI.jsx";
import { PERIOD_OPTIONS, MAX_DIMENSIONS } from "../../utils/formatMetric.js";

export default function RootCauseConfig({
  profile,
  metricColumn,
  dateColumn,
  period,
  dimensionColumns,
  onChangeMetric,
  onChangeDate,
  onChangePeriod,
  onToggleDimension,
  onAnalyze,
  loading,
}) {
  const numericalColumns = profile?.numerical_columns || [];
  const datetimeColumns = profile?.datetime_columns || [];
  const categoricalColumns = profile?.categorical_columns || [];

  const dimensionLimitReached = dimensionColumns.length >= MAX_DIMENSIONS;
  const canAnalyze = Boolean(metricColumn && dateColumn && dimensionColumns.length > 0) && !loading;

  return (
    <Card title="Analysis Configuration">
      <div className="space-y-5">
        <div>
          <label htmlFor="rca-metric" className="text-xs text-slate-400 block mb-1.5">
            Metric
          </label>
          <select
            id="rca-metric"
            value={metricColumn}
            onChange={(e) => onChangeMetric(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select a numeric metric</option>
            {numericalColumns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rca-date" className="text-xs text-slate-400 block mb-1.5">
            Date column
          </label>
          <select
            id="rca-date"
            value={dateColumn}
            onChange={(e) => onChangeDate(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select a date column</option>
            {datetimeColumns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="text-xs text-slate-400 block mb-1.5">Analysis period</legend>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Analysis period">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={period === opt.id}
                onClick={() => onChangePeriod(opt.id)}
                className={`text-xs px-2 py-2 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  period === opt.id
                    ? "bg-brand-600 text-white"
                    : "bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800/60"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs text-slate-400 block mb-1.5">
            Dimensions <span className="text-slate-600">(up to {MAX_DIMENSIONS})</span>
          </legend>
          {categoricalColumns.length === 0 ? (
            <p className="text-xs text-slate-500">No categorical columns available in this dataset.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categoricalColumns.map((c) => {
                const selected = dimensionColumns.includes(c);
                const disabled = !selected && dimensionLimitReached;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => onToggleDimension(c)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      selected
                        ? "bg-brand-600/20 text-brand-300 border border-brand-500/40"
                        : "bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800/60 disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    {selected && <Check size={12} />}
                    {c}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <button
          onClick={onAnalyze}
          disabled={!canAnalyze}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 transition px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? "Analyzing..." : "Analyze Causes"}
        </button>
      </div>
    </Card>
  );
}
