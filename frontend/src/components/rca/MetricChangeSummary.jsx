import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "../UI.jsx";
import { formatMetricValue, formatPercent, formatPeriodLabel } from "../../utils/formatMetric.js";

export default function MetricChangeSummary({ metric, comparison }) {
  if (!comparison) return null;

  const {
    previous_period,
    current_period,
    previous_value,
    current_value,
    absolute_change,
    percentage_change,
    direction,
  } = comparison;

  const isIncrease = direction === "increase";
  const isDecrease = direction === "decrease";
  const Icon = isIncrease ? TrendingUp : isDecrease ? TrendingDown : Minus;
  const toneClasses = isIncrease
    ? "text-emerald-400 bg-emerald-500/10"
    : isDecrease
    ? "text-red-400 bg-red-500/10"
    : "text-slate-400 bg-slate-500/10";

  return (
    <Card>
      <div className="flex items-start gap-4 mb-6">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${toneClasses}`}>
          <Icon size={22} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-slate-100">
            {metric} {direction || "changed"} {formatPercent(Math.abs(percentage_change))}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {formatPeriodLabel(previous_period)} → {formatPeriodLabel(current_period)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Previous Period" value={formatMetricValue(previous_value, metric)} />
        <Stat label="Current Period" value={formatMetricValue(current_value, metric)} />
        <Stat
          label="Absolute Change"
          value={formatMetricValue(absolute_change, metric)}
          tone={isIncrease ? "good" : isDecrease ? "bad" : "default"}
        />
        <Stat
          label="Percentage Change"
          value={formatPercent(percentage_change, { signed: true })}
          tone={isIncrease ? "good" : isDecrease ? "bad" : "default"}
        />
      </div>
    </Card>
  );
}

function Stat({ label, value, tone = "default" }) {
  const toneClasses = {
    default: "text-slate-100",
    good: "text-emerald-400",
    bad: "text-red-400",
  };
  return (
    <div className="bg-slate-900/60 rounded-xl p-3.5">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${toneClasses[tone]}`}>{value}</div>
    </div>
  );
}
