import React, { useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Card } from "../UI.jsx";
import { formatMetricValue, formatPercent } from "../../utils/formatMetric.js";
import AnalysisEmptyState from "./AnalysisEmptyState.jsx";

const RECONCILIATION_EPSILON = 1e-6;

export default function DimensionBreakdown({ dimensions, metric }) {
  const [active, setActive] = useState(0);

  if (!dimensions || dimensions.length === 0) return null;

  const current = dimensions[active] || dimensions[0];
  const contributors = current.contributors || [];
  const reconciled = current.reconciliation
    ? Math.abs(current.reconciliation.error ?? 0) <= RECONCILIATION_EPSILON
    : null;

  return (
    <Card
      title="Dimension Breakdown"
      action={
        reconciled !== null && (
          <span
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              reconciled ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
            }`}
          >
            {reconciled ? <CheckCircle2 size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />}
            {reconciled ? "Analysis reconciled" : "Reconciliation gap"}
          </span>
        )
      }
    >
      <div className="flex gap-1 mb-4 flex-wrap" role="tablist" aria-label="Dimensions">
        {dimensions.map((d, i) => (
          <button
            key={d.dimension}
            role="tab"
            aria-selected={active === i}
            onClick={() => setActive(i)}
            className={`text-xs px-3 py-1.5 rounded-lg transition ${
              active === i
                ? "bg-brand-600 text-white"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800/60"
            }`}
          >
            {d.dimension}
          </button>
        ))}
      </div>

      {contributors.length === 0 ? (
        <AnalysisEmptyState preset="no-contributors" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 text-xs uppercase">
                <th className="py-2 pr-4">{current.dimension}</th>
                <th className="py-2 pr-4">Previous</th>
                <th className="py-2 pr-4">Current</th>
                <th className="py-2 pr-4">Change</th>
                <th className="py-2 pr-4">Contribution %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[...contributors]
                .sort((a, b) => (b.contribution_pct ?? 0) - (a.contribution_pct ?? 0))
                .map((c, i) => (
                  <tr key={`${c.value}-${i}`}>
                    <td className="py-2 pr-4 font-medium text-slate-200">{c.value}</td>
                    <td className="py-2 pr-4 text-slate-400">{formatMetricValue(c.previous_value, metric)}</td>
                    <td className="py-2 pr-4 text-slate-400">{formatMetricValue(c.current_value, metric)}</td>
                    <td className={`py-2 pr-4 ${c.change < 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {formatMetricValue(c.change, metric)}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">{formatPercent(c.contribution_pct)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
