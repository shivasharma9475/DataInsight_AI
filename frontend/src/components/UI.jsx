import React from "react";

export function StatCard({ label, value, sub, tone = "default" }) {
  const toneClasses = {
    default: "text-slate-100",
    warn: "text-amber-400",
    danger: "text-red-400",
    good: "text-emerald-400",
  };
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">{label}</div>
      <div className={`text-2xl font-semibold ${toneClasses[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = "" }) {
  return (
    <div className={`glass rounded-2xl p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-sm font-semibold text-slate-200">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }) {
  return <div className={`animate-pulse bg-slate-800 rounded ${className}`} />;
}

export function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 text-slate-500">
      {Icon && <Icon size={32} className="mb-3 opacity-60" />}
      <div className="font-medium text-slate-300">{title}</div>
      {desc && <div className="text-sm mt-1 max-w-sm">{desc}</div>}
    </div>
  );
}
