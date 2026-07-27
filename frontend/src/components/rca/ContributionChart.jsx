import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Card } from "../UI.jsx";
import { formatMetricValue } from "../../utils/formatMetric.js";

const tooltipStyle = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  fontSize: 12,
  color: "#e2e8f0",
};

function truncate(label, max = 16) {
  if (!label) return label;
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export default function ContributionChart({ contributors, metric, title = "Contribution to metric change" }) {
  if (!contributors || contributors.length === 0) return null;

  const data = [...contributors]
    .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))
    .slice(0, 8)
    .map((c) => ({
      name: truncate(String(c.value)),
      fullName: String(c.value),
      change: c.change,
    }))
    .reverse();

  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => formatMetricValue(v, metric)} />
          <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={110} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [formatMetricValue(value, metric), "Change"]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
          />
          <Bar dataKey="change" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.change < 0 ? "#f87171" : "#34d399"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
