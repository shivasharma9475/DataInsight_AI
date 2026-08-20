import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  UploadCloud,
  SearchCode,
  MessageSquare,
  Brain,
  Calculator,
  FileDown,
  Send,
  Bot,
  User,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  Target,
  TrendingUp,
  Layers,
  GitBranch,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import AuthBrand from "../components/AuthBrand";

/* -----------------------------------------------------------
   Demo dataset — mirrors sample_data/sales_sample.csv so the
   sandbox reflects the same columns real users see after upload.
   date, region, product, sales, units_sold, customer_churn
----------------------------------------------------------- */
const DEMO_DATASET = {
  name: "sales_sample.csv",
  rows: "18,400 rows",
};

const FEATURES = [
  {
    icon: UploadCloud,
    title: "Zero-code ingestion",
    desc: "Drop in any CSV or Excel file — schema, types, and quality are detected instantly.",
  },
  {
    icon: SearchCode,
    title: "Root Cause Analysis",
    desc: "Pick a metric and a time period. See exactly which segments drove the change, ranked by contribution.",
  },
  {
    icon: MessageSquare,
    title: "Chat with your data",
    desc: "Ask questions in plain English. Every answer is grounded in your dataset, with the analysis steps shown.",
  },
  {
    icon: Brain,
    title: "ML Studio",
    desc: "Classification, regression, clustering, and forecasting — pick a task, pick a target, run it. No notebooks.",
  },
  {
    icon: Calculator,
    title: "What-if Simulator",
    desc: "Adjust a metric or segment by a percentage and get a deterministic, verifiable projected impact.",
  },
  {
    icon: FileDown,
    title: "Recommendations & Reports",
    desc: "Get AI-suggested next steps, then export a polished PDF or Excel report for stakeholders in one click.",
  },
];

const TABS = [
  { id: "chat", label: "Chat with Data", icon: MessageSquare },
  { id: "rca", label: "Root Cause Analysis", icon: SearchCode },
  { id: "ml", label: "ML Studio", icon: Brain },
  { id: "whatif", label: "What-if Simulator", icon: Calculator },
];

const CHAT_SUGGESTIONS = [
  "Summarize this dataset",
  "What is the total sales?",
  "sales by region",
  "Show monthly sales trend",
  "Why did sales change?",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#020302] bg-grid-glow bg-grid-pattern text-slate-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-2">
          <Link to="/" className="shrink-0">
  <AuthBrand />
</Link>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <a href="#sandbox" className="hover:text-white transition">Interactive Demo</a>
          <a href="#features" className="hover:text-white transition">Platform</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-slate-300 hover:text-white transition">Log in</Link>
          <Link to="/signup" className="btn-primary text-sm px-4 py-2">
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 md:px-12 pt-16 pb-16 text-center max-w-4xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold tracking-tight text-white"
        >
          Upload Any Dataset.
          <br />
          <span className="bg-gradient-to-r from-brand-400 via-slate-300 to-brand-300 bg-clip-text text-transparent">
            Get Instant AI-Powered Insights.
          </span>
        </motion.h1>
        <p className="mt-6 text-slate-400 text-lg max-w-2xl mx-auto">
          A mini Power BI + ChatGPT for your spreadsheets — automatic cleaning, EDA, root cause analysis,
          machine learning, what-if simulation, and a chatbot that understands your data. No code required.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link to="/signup" className="btn-primary px-6 py-3">
            Start analyzing — it's free
          </Link>
          <a href="#sandbox" className="btn-ghost px-6 py-3">
            Try the interactive demo
          </a>
        </div>
      </section>

      {/* Interactive Sandbox */}
      <Sandbox />

      {/* Feature grid */}
      <section id="features" className="px-6 md:px-12 py-24 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Everything on one platform</h2>
          <p className="text-slate-400 mt-2">The same tools you just tried above, available the moment you upload your own data.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="glass rounded-2xl p-6"
            >
              <div className="w-10 h-10 rounded-lg icon-badge flex items-center justify-center mb-4">
                <Icon size={18} className="text-brand-400" />
              </div>
              <h3 className="font-semibold mb-1.5 text-white">{title}</h3>
              <p className="text-sm text-slate-400">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* =============================================================
   Sandbox — tabs mirror the real app's sidebar 1:1:
   Chat with Data, Root Cause Analysis, ML Studio, What-if Simulator
============================================================= */
function Sandbox() {
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <section id="sandbox" className="px-6 md:px-12 py-16 border-y border-white/[0.06]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-black/40 border border-brand-500/30 text-brand-300 text-xs font-mono mb-3">
            <Sparkles size={12} />
            <span>LIVE_DEMO_ENVIRONMENT</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Try it on a sample dataset</h2>
          <p className="text-slate-400 mt-2 max-w-2xl mx-auto text-sm md:text-base">
            This is the exact interface you get after uploading — grounded on{" "}
            <span className="font-mono text-brand-300">{DEMO_DATASET.name}</span> ({DEMO_DATASET.rows}).
          </p>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-white/[0.06] bg-black/40 px-3 pt-3">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 rounded-t-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap border-b-2 ${
                    active
                      ? "text-brand-300 border-brand-500"
                      : "text-slate-500 border-transparent hover:text-slate-300"
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-6 min-h-[460px] bg-black/20">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === "chat" && <ChatDemo />}
                {activeTab === "rca" && <RootCauseDemo />}
                {activeTab === "ml" && <MLStudioDemo />}
                {activeTab === "whatif" && <WhatIfDemo />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------
   Tab 1 — Chat with Data (mirrors pages/Chat.jsx)
------------------------------------------------------------- */
function AnalysisSteps({ steps = [], evidence = [], warnings = [] }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0 && warnings.length === 0) return null;

  return (
    <div className="mt-1.5 max-w-[85%]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition"
      >
        <ListChecks size={12} />
        {open ? "Hide analysis steps" : "Show analysis steps"}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="mt-2 rounded-xl bg-black/50 border border-white/10 p-3 text-xs text-slate-400 space-y-2">
          {steps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {steps.map((s, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
                  {i + 1}. {s}
                </span>
              ))}
            </div>
          )}
          {evidence.length > 0 && (
            <div className="space-y-1.5">
              {evidence.map((e, i) => (
                <div key={i}>
                  <span className="text-slate-500">{e.tool}:</span>{" "}
                  <span className="text-slate-400">{e.summary}</span>
                </div>
              ))}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="pt-1 border-t border-white/10 text-amber-400/80">
              {warnings.map((w, i) => <div key={i}>{w}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const INITIAL_CHAT = [
  { role: "user", text: "Why did sales change in Q2?" },
  {
    role: "assistant",
    text:
      "Sales fell 15.2% quarter-over-quarter, from $284,500 to $241,200. The West region drove most of the decline (-42% contribution), concentrated in Widget C. units_sold in West dropped 19% over the same period, while other regions stayed roughly flat.",
    steps: ["trend_analysis", "root_cause", "segment_breakdown"],
    evidence: [
      { tool: "trend_analysis", summary: "sales: -15.2% (Q1 -> Q2), largest MoM drop in April" },
      { tool: "root_cause", summary: "region=West contributes -42% of total change" },
    ],
    warnings: [],
  },
];

function ChatDemo() {
  const [messages, setMessages] = useState(INITIAL_CHAT);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const send = (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;

    setMessages((cur) => [...cur, { role: "user", text: msg }]);
    setInput("");
    setSending(true);

    setTimeout(() => {
      setMessages((cur) => [
        ...cur,
        {
          role: "assistant",
          text: `Evaluated ${DEMO_DATASET.rows.replace(" rows", "")} rows across ${
            msg.toLowerCase().includes("region") ? "region" : "date"
          } with 99.1% statistical confidence.`,
          steps: ["aggregate_metric"],
          evidence: [{ tool: "aggregate_metric", summary: "grouped on sales_sample.csv" }],
          warnings: [],
        },
      ]);
      setSending(false);
    }, 700);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col">
      <div className="mb-4 flex items-center gap-2">
        <Bot size={18} className="text-brand-400" />
        <div>
          <div className="text-sm font-semibold text-white">Chat with your data</div>
          <div className="text-xs text-slate-500">Grounded on {DEMO_DATASET.name}</div>
        </div>
      </div>

      <div className="max-h-[280px] overflow-y-auto pr-1 space-y-4 mb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                m.role === "user" ? "bg-black border-brand-500/40 text-brand-300" : "bg-black border-white/10 text-slate-300"
              }`}
            >
              {m.role === "user" ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className="flex flex-col">
              <div
                className={`max-w-full rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap border ${
                  m.role === "user"
                    ? "bg-brand-900/40 border-brand-500/30 text-slate-100"
                    : "bg-black/50 border-white/10 text-slate-200"
                }`}
              >
                {m.text}
              </div>
              {m.role === "assistant" && (
                <AnalysisSteps steps={m.steps} evidence={m.evidence} warnings={m.warnings} />
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-black border border-white/10 flex items-center justify-center">
              <Bot size={14} />
            </div>
            <div className="bg-black/50 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-slate-400">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {CHAT_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={sending}
            className="text-xs bg-black/40 border border-white/10 hover:border-white/20 transition px-3 py-1.5 rounded-full text-slate-300 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-xl p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your data..."
          disabled={sending}
          className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="btn-primary p-2.5 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------
   Tab 2 — Root Cause Analysis (mirrors pages/RootCause.jsx)
------------------------------------------------------------- */
function RootCauseDemo() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const analyze = () => {
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      setResult({
        previous: 284500,
        current: 241200,
        pctChange: -15.2,
        contributors: [
          { segment: "region = West", contribution: -42 },
          { segment: "product = Widget C", contribution: -28 },
          { segment: "region = North", contribution: -9 },
          { segment: "product = Widget A", contribution: 6 },
        ],
      });
      setLoading(false);
    }, 900);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Config */}
      <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-mono uppercase text-brand-300 mb-1">Configuration</h4>
        {[
          ["Metric column", "sales"],
          ["Date column", "date"],
          ["Period", "Monthly"],
          ["Dimensions", "region, product"],
        ].map(([label, val]) => (
          <div key={label}>
            <label className="text-xs text-slate-500 block mb-1">{label}</label>
            <div className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300">
              {val}
            </div>
          </div>
        ))}
        <button
          onClick={analyze}
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <SearchCode size={16} />}
          {loading ? "Analyzing..." : "Analyze Causes"}
        </button>
      </div>

      {/* Results */}
      <div className="md:col-span-2 space-y-4">
        {!result && !loading && (
          <div className="bg-black/40 border border-white/10 rounded-xl p-8 text-center text-slate-500 text-sm">
            Choose a metric, date column, period, and dimensions, then click Analyze Causes.
          </div>
        )}
        {loading && (
          <div className="bg-black/40 border border-white/10 rounded-xl p-5 flex items-center gap-3 text-sm text-slate-300">
            <Loader2 size={18} className="animate-spin text-brand-400" />
            Analyzing metric changes and contributors…
          </div>
        )}
        {result && (
          <>
            <div className="bg-black/40 border border-white/10 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-2">sales — Monthly comparison</div>
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs text-slate-500">Previous</div>
                  <div className="text-xl font-semibold text-slate-200">
                    ${result.previous.toLocaleString()}
                  </div>
                </div>
                <ArrowRight className="text-slate-600" size={20} />
                <div>
                  <div className="text-xs text-slate-500">Current</div>
                  <div className="text-xl font-semibold text-slate-200">
                    ${result.current.toLocaleString()}
                  </div>
                </div>
                <span className="ml-auto text-sm font-semibold text-red-400">{result.pctChange}%</span>
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-slate-200 mb-3">Top Contributors</h4>
              <div className="space-y-2.5">
                {result.contributors.map((c) => (
                  <div key={c.segment}>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>{c.segment}</span>
                      <span className={c.contribution < 0 ? "text-red-400" : "text-brand-400"}>
                        {c.contribution > 0 ? "+" : ""}
                        {c.contribution}%
                      </span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          c.contribution < 0 ? "bg-red-500/60" : "bg-brand-500/60"
                        }`}
                        style={{ width: `${Math.min(Math.abs(c.contribution) * 2, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   Tab 3 — ML Studio (mirrors pages/MLStudio.jsx)
------------------------------------------------------------- */
const TASKS = [
  { id: "classification", label: "Classification", icon: Target, desc: "Predict a category", target: "customer_churn" },
  { id: "regression", label: "Regression", icon: TrendingUp, desc: "Predict a number", target: "sales" },
  { id: "clustering", label: "Clustering", icon: Layers, desc: "Find natural groups", target: null },
  { id: "forecasting", label: "Forecasting", icon: GitBranch, desc: "Project a trend forward", target: "sales" },
];

const ML_RESULTS = {
  classification: {
    bestModel: "Random Forest",
    models: {
      "Logistic Regression": { accuracy: "0.81", f1: "0.77" },
      "Random Forest": { accuracy: "0.89", f1: "0.86" },
      XGBoost: { accuracy: "0.88", f1: "0.85" },
    },
    importance: { units_sold: 0.42, region: 0.31, product: 0.18, sales: 0.09 },
  },
  regression: {
    bestModel: "XGBoost",
    models: {
      "Linear Regression": { r2: "0.61", rmse: "412.3" },
      "Random Forest": { r2: "0.78", rmse: "289.1" },
      XGBoost: { r2: "0.84", rmse: "241.7" },
    },
    importance: { units_sold: 0.55, region: 0.24, product: 0.21 },
  },
  clustering: {
    algorithm: "K-Means",
    clusters: 3,
    silhouette: 0.62,
    sizes: { "0": 620, "1": 410, "2": 245 },
  },
  forecasting: {
    method: "Prophet",
    trend: "upward",
    pctChange: 8.4,
  },
};

function MLStudioDemo() {
  const [task, setTask] = useState("regression");
  const [running, setRunning] = useState(false);
  const [showResult, setShowResult] = useState(true);

  const runModel = () => {
    setRunning(true);
    setShowResult(false);
    setTimeout(() => {
      setRunning(false);
      setShowResult(true);
    }, 1000);
  };

  const activeTask = TASKS.find((t) => t.id === task);
  const result = ML_RESULTS[task];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {TASKS.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => {
              setTask(id);
              setShowResult(true);
            }}
            className={`bg-black/40 border rounded-xl p-4 text-left transition ${
              task === id ? "border-brand-500/60 bg-brand-900/20" : "border-white/10 hover:border-white/20"
            }`}
          >
            <Icon size={18} className="text-brand-400 mb-2" />
            <div className="text-sm font-medium text-slate-200">{label}</div>
            <div className="text-xs text-slate-500">{desc}</div>
          </button>
        ))}
      </div>

      <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-5 flex flex-wrap items-end gap-4">
        {activeTask.target && (
          <div>
            <label className="text-xs text-slate-500 block mb-1">Target column</label>
            <div className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300">
              {activeTask.target}
            </div>
          </div>
        )}
        <button
          onClick={runModel}
          disabled={running}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? "Running..." : "Run model"}
        </button>
      </div>

      {showResult && (
        <div className="space-y-4">
          {(task === "classification" || task === "regression") && (
            <div className="bg-black/40 border border-white/10 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-slate-200 mb-3">Best model: {result.bestModel}</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {Object.entries(result.models).map(([name, metrics]) => (
                  <div
                    key={name}
                    className={`bg-black/50 border rounded-xl p-3 ${
                      name === result.bestModel ? "border-brand-500/50" : "border-white/10"
                    }`}
                  >
                    <div className="text-xs text-slate-400 mb-1">{name}</div>
                    {Object.entries(metrics).map(([k, v]) => (
                      <div key={k} className="text-xs text-slate-500 flex justify-between">
                        <span>{k}</span>
                        <span className="text-slate-300">{v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-400 mb-2">Feature importance</div>
              <div className="space-y-1.5">
                {Object.entries(result.importance)
                  .sort((a, b) => b[1] - a[1])
                  .map(([f, v]) => (
                    <div key={f} className="flex items-center gap-2 text-xs">
                      <div className="w-24 text-slate-400 truncate">{f}</div>
                      <div className="flex-1 bg-white/5 rounded-full h-2">
                        <div className="bg-brand-500/70 h-2 rounded-full" style={{ width: `${v * 100}%` }} />
                      </div>
                      <div className="w-10 text-right text-slate-500">{v}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {task === "clustering" && (
            <div className="bg-black/40 border border-white/10 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-slate-200 mb-2">
                {result.algorithm} — {result.clusters} clusters found
              </h4>
              <div className="text-sm text-slate-400 mb-3">
                Silhouette score: {result.silhouette} (closer to 1 = better separated clusters)
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(result.sizes).map(([c, n]) => (
                  <span key={c} className="text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-full text-slate-300">
                    Cluster {c}: {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          {task === "forecasting" && (
            <div className="bg-black/40 border border-white/10 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-slate-200 mb-3">
                {result.method} — trend is {result.trend} ({result.pctChange}% projected change)
              </h4>
              <div className="flex items-end gap-1.5 h-20">
                {[35, 42, 38, 50, 58, 55, 68, 74, 80, 88].map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${i >= 7 ? "bg-brand-500/60" : "bg-white/10"}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------
   Tab 4 — What-if Simulator (mirrors pages/WhatIfSimulator.jsx)
------------------------------------------------------------- */
function WhatIfDemo() {
  const [changePct, setChangePct] = useState(10);
  const segment = "region = West";
  const baseline = 241200;

  const { projected, absoluteImpact, percentageImpact } = useMemo(() => {
    const projected = Math.round(baseline * (1 + changePct / 100));
    const absoluteImpact = projected - baseline;
    return { projected, absoluteImpact, percentageImpact: changePct };
  }, [changePct]);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl icon-badge flex items-center justify-center">
            <Calculator size={18} className="text-brand-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">What-if Simulator</h3>
            <p className="text-xs text-slate-500">
              Explore how changing a metric or segment could affect your results.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Metric column</label>
            <div className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300">
              sales
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Segment</label>
            <div className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300">
              {segment}
            </div>
          </div>
        </div>

        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Change percentage</span>
            <span className="font-mono text-brand-300">
              {changePct >= 0 ? "+" : ""}
              {changePct}%
            </span>
          </div>
          <input
            type="range"
            min="-30"
            max="50"
            value={changePct}
            onChange={(e) => setChangePct(Number(e.target.value))}
            className="w-full accent-brand-500 cursor-pointer"
          />
        </div>

        <button
          onClick={() => setChangePct(10)}
          className="mt-3 flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition"
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Simulation Result</h3>
            <p className="text-xs text-slate-500">Deterministic scenario analysis</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-brand-400">
            <CheckCircle2 size={14} /> Verified calculation
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-5">
          <div className="bg-black/50 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-xs text-slate-500 mb-1">Baseline Total</div>
            <div className="text-lg font-semibold text-slate-200">${baseline.toLocaleString()}</div>
          </div>
          <div className="flex justify-center">
            <ArrowRight className="text-slate-600" size={22} />
          </div>
          <div className="bg-black/50 border border-brand-500/40 rounded-xl p-4 text-center">
            <div className="text-xs text-slate-500 mb-1">Projected Total</div>
            <div className="text-lg font-semibold text-brand-300">${projected.toLocaleString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/50 border border-white/10 rounded-xl p-4">
            <div className="text-xs text-slate-500 mb-1">Absolute Impact</div>
            <div className={`text-lg font-semibold ${absoluteImpact >= 0 ? "text-brand-400" : "text-red-400"}`}>
              {absoluteImpact >= 0 ? "+" : ""}
              ${absoluteImpact.toLocaleString()}
            </div>
          </div>
          <div className="bg-black/50 border border-white/10 rounded-xl p-4">
            <div className="text-xs text-slate-500 mb-1">Total Impact</div>
            <div className={`text-lg font-semibold ${percentageImpact >= 0 ? "text-brand-400" : "text-red-400"}`}>
              {percentageImpact >= 0 ? "+" : ""}
              {percentageImpact}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}