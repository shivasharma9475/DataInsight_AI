import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatMetricValue, formatPercent } from "../../utils/formatMetric.js";
import AnalysisEmptyState from "./AnalysisEmptyState.jsx";

export default function ContributorList({ contributors, metric }) {
  if (!contributors || contributors.length === 0) {
    return <AnalysisEmptyState preset="no-contributors" />;
  }

  const sorted = [...contributors].sort((a, b) => (b.contribution_pct ?? 0) - (a.contribution_pct ?? 0));
  const isTop = (i) => i === 0;

  return (
    <div className="space-y-3">
      {sorted.map((c, i) => {
        const negative = c.impact === "negative" || c.change < 0;
        return (
          <div key={`${c.dimension}-${c.value}-${i}`} className="bg-slate-900/60 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
                  {c.value}
                  {isTop(i) && (
                    <span className="text-[10px] uppercase tracking-wide bg-brand-600/30 text-brand-300 px-1.5 py-0.5 rounded">
                      Largest contributor
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {formatMetricValue(c.previous_value, metric)} → {formatMetricValue(c.current_value, metric)}
                </div>
              </div>
              <div className={`flex items-center gap-1 text-sm font-medium shrink-0 ${negative ? "text-red-400" : "text-emerald-400"}`}>
                {negative ? <ArrowDownRight size={15} aria-hidden="true" /> : <ArrowUpRight size={15} aria-hidden="true" />}
                {formatMetricValue(c.change, metric)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-800 rounded-full h-2" role="presentation">
                <div
                  className={`h-2 rounded-full ${negative ? "bg-red-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(Math.abs(c.contribution_pct ?? 0), 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 w-16 text-right shrink-0">
                {formatPercent(c.contribution_pct)} of change
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1.5">
              {negative ? "Contributed to the decline" : "Contributed to the increase"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
