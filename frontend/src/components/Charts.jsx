import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { Card } from "./UI.jsx";

const COLORS = ["#22916c", "#3fae85", "#5eead4", "#f472b6", "#fb923c", "#22d3ee", "#a3e635", "#facc15"];

const tooltipStyle = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  fontSize: 12,
  color: "#e2e8f0",
};

/* Small inline trend line used inside KPI cards. No axes, no fabricated data —
   pass real historical values in, or omit the `spark` prop on KPICard entirely. */
export function Sparkline({ values, tone = "default" }) {
  if (!values || values.length < 2) return null;
  const strokeByTone = {
    default: "#64748b",
    good: "#34d399",
    warn: "#fbbf24",
    danger: "#f87171",
  };
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={28}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={strokeByTone[tone] || strokeByTone.default}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HistogramChart({ title, bins, counts }) {
  if (!bins || !counts) return null;
  const data = counts.map((c, i) => ({
    range: `${bins[i].toFixed(1)}–${bins[i + 1].toFixed(1)}`,
    count: c,
  }));
  return (
    <Card
      title={title}
      action={
        <span className="text-slate-600" title="Distribution of values across the column's range">
          ⓘ
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="range" hide />
          <YAxis stroke="#475569" fontSize={10} width={28} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" fill="#22916c" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function BarCategoryChart({ title, labels, values }) {
  if (!labels || !values) return null;
  const data = labels.map((l, i) => ({ name: l, value: values[i] }));
  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" stroke="#475569" fontSize={11} />
          <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={90} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#1e293b55" }} />
          <Bar dataKey="value" fill="#3fae85" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function PieCategoryChart({ title, labels, values }) {
  if (!labels || !values) return null;
  const data = labels.map((l, i) => ({ name: l, value: values[i] }));
  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function TrendLineChart({ title, x, y, xLabel, yLabel, forecastX, forecastY }) {
  if (!x || !y) return null;
  const data = x.map((v, i) => ({ x: v, actual: y[i] }));
  const merged = forecastX
    ? [...data, ...forecastX.map((v, i) => ({ x: v, forecast: forecastY[i] }))]
    : data;
  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={merged}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="x" stroke="#64748b" fontSize={10} minTickGap={30} />
          <YAxis stroke="#64748b" fontSize={11} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="actual" stroke="#22916c" dot={false} strokeWidth={2} name={yLabel || "Actual"} />
          {forecastX && (
            <Line type="monotone" dataKey="forecast" stroke="#f472b6" strokeDasharray="5 5" dot={false} strokeWidth={2} name="Forecast" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function ScatterChartCard({ title, x, y, xLabel, yLabel, clusters }) {
  if (!x || !y) return null;
  const data = x.map((v, i) => ({ x: v, y: y[i], cluster: clusters ? clusters[i] : 0 }));
  const groups = clusters ? [...new Set(clusters)] : [0];
  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis type="number" dataKey="x" name={xLabel} stroke="#64748b" fontSize={11} />
          <YAxis type="number" dataKey="y" name={yLabel} stroke="#64748b" fontSize={11} />
          <ZAxis range={[40, 40]} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
          {groups.map((g, i) => (
            <Scatter
              key={g}
              data={data.filter((d) => d.cluster === g)}
              fill={COLORS[i % COLORS.length]}
              name={clusters ? `Cluster ${g}` : "Points"}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function CorrelationHeatmap({ columns, matrix, action }) {
  if (!columns || !matrix || columns.length === 0) return null;
  const cellColor = (v) => {
    const intensity = Math.min(Math.abs(v), 1);
    return v >= 0
      ? `rgba(34, 145, 108, ${intensity})`
      : `rgba(244, 63, 94, ${intensity})`;
  };
  return (
    <Card title="Correlation Matrix" action={action}>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr>
              <th className="p-1" />
              {columns.map((c) => (
                <th key={c} className="p-1 text-slate-500 font-normal whitespace-nowrap px-2">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td className="p-1 text-slate-500 whitespace-nowrap pr-2">{columns[i]}</td>
                {row.map((v, j) => (
                  <td
                    key={j}
                    className="p-1 text-center w-12 h-8 text-slate-100 rounded"
                    style={{ background: cellColor(v) }}
                    title={`${columns[i]} × ${columns[j]}: ${v}`}
                  >
                    {v.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function BoxPlotSummary({ title, stats }) {
  if (!stats) return null;
  return (
    <Card title={title}>
      <div className="grid grid-cols-5 gap-2 text-center text-xs">
        {Object.entries({ Min: stats.min, Q1: stats.q1, Median: stats.median, Q3: stats.q3, Max: stats.max }).map(
          ([label, val]) => (
            <div key={label} className="bg-slate-950/50 border border-slate-800/60 rounded-lg py-2.5">
              <div className="text-slate-500">{label}</div>
              <div className="font-medium text-slate-200 mt-0.5">{Number(val).toFixed(1)}</div>
            </div>
          )
        )}
      </div>
    </Card>
  );
}