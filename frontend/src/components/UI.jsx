import React from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Sparkline } from "./Charts.jsx";

/* Shared focus-visible ring for every interactive element in this file —
   keeps keyboard focus consistent without adding visual noise for mouse users. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050606] rounded-lg";

/* ----------------------------- Card shell ----------------------------- */

export function Card({ title, subtitle, action, children, className = "", noPad = false }) {
  return (
    <div className={`glass border border-slate-800/60 rounded-2xl ${noPad ? "" : "p-5"} ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-200">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      {action}
    </div>
  );
}

export function ViewAllLink({ children = "View all", onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-medium text-brand-400 hover:text-brand-300 transition ${focusRing}`}
    >
      {children}
    </button>
  );
}

/* -------------------------------- States -------------------------------- */

export function Skeleton({ className = "h-4 w-full" }) {
  return <div className={`animate-pulse bg-slate-800/80 rounded ${className}`} />;
}

export function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 text-slate-500">
      {Icon && <Icon size={32} className="mb-3 opacity-50" />}
      <div className="font-medium text-slate-300">{title}</div>
      {desc && <div className="text-sm mt-1 max-w-sm text-slate-500">{desc}</div>}
    </div>
  );
}

/* -------------------------------- Badges -------------------------------- */

const TYPE_BADGE_STYLES = {
  numerical: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  categorical: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  datetime: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  boolean: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  text: "bg-slate-500/10 text-slate-300 border-slate-500/20",
};

export function TypeBadge({ type }) {
  const cls = TYPE_BADGE_STYLES[type?.toLowerCase()] || TYPE_BADGE_STYLES.text;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium capitalize ${cls}`}>
      {type}
    </span>
  );
}

export function StatusDot({ tone = "good" }) {
  const cls = {
    good: "bg-emerald-400",
    warn: "bg-amber-400",
    danger: "bg-red-400",
    neutral: "bg-slate-500",
  }[tone];
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls}`} />;
}

/* -------------------------------- KPI card -------------------------------- */

/**
 * Generic metric card. `trend` is optional (e.g. { direction: "up"|"down"|"flat", label: "12.5% vs prev period" }).
 * Only pass `trend` / `spark` when you have a real, computed value for it — this component
 * never invents one on its own.
 */
export function KPICard({ icon: Icon, label, value, sub, tone = "default", trend, spark, iconTone }) {
  const toneClasses = {
    default: "text-slate-100",
    warn: "text-amber-400",
    danger: "text-red-400",
    good: "text-emerald-400",
  };
  const iconWrap = {
    default: "bg-slate-800 text-slate-300",
    warn: "bg-amber-500/10 text-amber-400",
    danger: "bg-red-500/10 text-red-400",
    good: "bg-emerald-500/10 text-emerald-400",
  };
  const TrendIcon = trend?.direction === "up" ? ArrowUp : trend?.direction === "down" ? ArrowDown : Minus;
  const trendTone =
    trend?.direction === "up"
      ? "text-emerald-400"
      : trend?.direction === "down"
      ? "text-red-400"
      : "text-slate-500";

  return (
    <div className="glass border border-slate-800/60 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconWrap[iconTone || tone]}`}>
            <Icon size={15} />
          </div>
        )}
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      </div>
      <div className={`text-2xl font-semibold ${toneClasses[tone]}`}>{value}</div>
      {trend && (
        <div className={`text-xs mt-1 flex items-center gap-1 ${trendTone}`}>
          <TrendIcon size={12} />
          {trend.label}
        </div>
      )}
      {!trend && sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
      {spark && (
        <div className="mt-2 -mx-1">
          <Sparkline values={spark} tone={tone} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Score ring ------------------------------ */

export function ScoreRing({ score, size = 92, label }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const tone =
    clamped >= 90 ? { stroke: "#34d399", text: "text-emerald-400", word: "Excellent" } :
    clamped >= 75 ? { stroke: "#5eead4", text: "text-teal-300", word: "Good" } :
    clamped >= 50 ? { stroke: "#fbbf24", text: "text-amber-400", word: "Fair" } :
    { stroke: "#f87171", text: "text-red-400", word: "Needs attention" };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="#1e293b" strokeWidth={8} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={tone.stroke}
            strokeWidth={8}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-slate-100 leading-none">{Math.round(clamped)}</span>
          <span className="text-[10px] text-slate-500 mt-0.5">/100</span>
        </div>
      </div>
      <div className={`text-xs font-medium mt-2 ${tone.text}`}>{label || tone.word}</div>
    </div>
  );
}

/** KPI-card-styled wrapper around ScoreRing, so it sits flush with the rest of the KPI row. */
export function QualityScoreCard({ score }) {
  if (score === null || score === undefined) return null;
  return (
    <div className="glass border border-slate-800/60 rounded-2xl p-4 flex flex-col items-center justify-center col-span-2 md:col-span-1">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1 self-start">
        Data Quality
      </div>
      <ScoreRing score={score} size={80} />
    </div>
  );
}

/* ------------------------------ Insight card ------------------------------ */

export function InsightCard({ icon: Icon, tone = "default", title, detail }) {
  const iconWrap = {
    default: "bg-slate-800 text-slate-300",
    good: "bg-emerald-500/10 text-emerald-400",
    warn: "bg-amber-500/10 text-amber-400",
    info: "bg-sky-500/10 text-sky-400",
    danger: "bg-red-500/10 text-red-400",
  }[tone];
  return (
    <div className="glass border border-slate-800/60 rounded-xl p-3 hover:border-slate-700 transition">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${iconWrap}`}>
            <Icon size={15} />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-200">{title}</div>
          <div className="text-xs text-slate-500 mt-1 leading-relaxed">{detail}</div>
        </div>
      </div>
    </div>
  );
}