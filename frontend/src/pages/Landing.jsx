import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, UploadCloud, BarChart3, Bot, Brain, FileDown } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: UploadCloud, title: "Zero-code ingestion", desc: "Drop in any CSV or Excel file — schema, types, and quality are detected instantly." },
  { icon: BarChart3, title: "Instant dashboards", desc: "Histograms, correlations, box plots, and trend lines generated automatically." },
  { icon: Bot, title: "Chat with your data", desc: "Ask questions in plain English and get answers grounded in your actual numbers." },
  { icon: Brain, title: "AutoML built-in", desc: "Classification, regression, clustering, and forecasting — no notebooks required." },
  { icon: FileDown, title: "Shareable reports", desc: "Export a polished PDF or Excel summary for stakeholders in one click." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 bg-grid-glow text-slate-100">
      <nav className="flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="font-semibold text-lg">DataInsight AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-slate-300 hover:text-white transition">Log in</Link>
          <Link to="/signup" className="text-sm bg-brand-600 hover:bg-brand-500 transition px-4 py-2 rounded-lg font-medium">
            Get started free
          </Link>
        </div>
      </nav>

      <section className="px-6 md:px-12 pt-16 pb-20 text-center max-w-4xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold tracking-tight"
        >
          Upload Any Dataset.
          <br />
          <span className="bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
            Get Instant AI-Powered Insights.
          </span>
        </motion.h1>
        <p className="mt-6 text-slate-400 text-lg max-w-2xl mx-auto">
          A mini Power BI + ChatGPT for your spreadsheets — automatic cleaning, EDA, machine learning,
          forecasting, and a chatbot that understands your data. No code required.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link to="/signup" className="bg-brand-600 hover:bg-brand-500 transition px-6 py-3 rounded-xl font-medium">
            Start analyzing — it's free
          </Link>
          <Link to="/login" className="border border-slate-700 hover:border-slate-500 transition px-6 py-3 rounded-xl font-medium">
            I already have an account
          </Link>
        </div>
      </section>

      <section className="px-6 md:px-12 pb-24 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
        {features.map(({ icon: Icon, title, desc }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="glass rounded-2xl p-6"
          >
            <div className="w-10 h-10 rounded-lg bg-brand-600/20 flex items-center justify-center mb-4">
              <Icon size={20} className="text-brand-400" />
            </div>
            <h3 className="font-semibold mb-1.5">{title}</h3>
            <p className="text-sm text-slate-400">{desc}</p>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
