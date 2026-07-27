import React, { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { Card } from "../UI.jsx";
import { formatMetricValue } from "../../utils/formatMetric.js";

export default function EvidencePanel({ comparison, dimensions, metric }) {
  const [open, setOpen] = useState(false);

  if (!comparison) return null;

  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <ShieldCheck size={16} className="text-brand-400" aria-hidden="true" />
          View Evidence
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <EvidenceStat label="Previous period total" value={formatMetricValue(comparison.previous_value, metric)} />
            <EvidenceStat label="Current period total" value={formatMetricValue(comparison.current_value, metric)} />
            <EvidenceStat label="Total change" value={formatMetricValue(comparison.absolute_change, metric)} />
          </div>

          {dimensions && dimensions.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Per-dimension reconciliation</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1.5 pr-4">Dimension</th>
                      <th className="py-1.5 pr-4">Dimension change</th>
                      <th className="py-1.5 pr-4">Overall change</th>
                      <th className="py-1.5 pr-4">Reconciliation error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {dimensions.map((d) => (
                      <tr key={d.dimension}>
                        <td className="py-1.5 pr-4 text-slate-300 font-medium">{d.dimension}</td>
                        <td className="py-1.5 pr-4 text-slate-400">
                          {formatMetricValue(d.reconciliation?.dimension_change, metric)}
                        </td>
                        <td className="py-1.5 pr-4 text-slate-400">
                          {formatMetricValue(d.reconciliation?.overall_change, metric)}
                        </td>
                        <td className="py-1.5 pr-4 text-slate-400">
                          {formatMetricValue(d.reconciliation?.error, metric)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function EvidenceStat({ label, value }) {
  return (
    <div className="bg-slate-900/60 rounded-xl p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <div className="text-sm font-medium text-slate-200">{value}</div>
    </div>
  );
}
