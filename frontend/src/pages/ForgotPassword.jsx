import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Sparkles } from "lucide-react";
import { authApi } from "../services/api.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await authApi.forgotPassword(email);

      setMessage(
        res.data?.message ||
          "If an account exists with this email, a reset link has been sent."
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Unable to send reset link. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 via-transparent to-black" />

      <div className="relative z-10 w-full max-w-[420px] rounded-[28px] border border-white/15 bg-white/[0.08] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl">

        <Link
          to="/login"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft size={16} />
          Back to login
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15">
            <Mail size={20} className="text-brand-300" />
          </div>

          <Sparkles size={18} className="text-brand-400" />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight">
          Forgot password?
        </h1>

        <p className="mt-3 mb-7 text-sm leading-6 text-slate-400">
          Enter your email address and we'll send you a link to reset your
          password.
        </p>

        {message && (
          <div className="mb-5 rounded-xl border border-brand-400/10 bg-brand-500/10 px-4 py-3 text-sm text-brand-300">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-400/10 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div className="grid gap-2">
            <label className="text-sm text-slate-300">
              Email address
            </label>

            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-brand-400/70 focus:bg-black/40 focus:ring-4 focus:ring-brand-400/10"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-12 w-full rounded-xl bg-brand-500 font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Remember your password?{" "}
          <Link
            to="/login"
            className="text-brand-300 hover:text-brand-200 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}