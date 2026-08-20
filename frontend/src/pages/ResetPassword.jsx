import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { authApi } from "../services/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data } = await authApi.resetPassword(
        token,
        password
      );

      setSuccess(
        data.message ||
          "Password updated successfully."
      );

      setTimeout(() => {
        navigate("/login");
      }, 1800);

    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Invalid or expired reset link."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">

      <div className="w-full max-w-[420px]">

        <Link
          to="/login"
          className="inline-flex items-center gap-2 mb-8 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft size={16} />
          Back to login
        </Link>

        <div className="rounded-[28px] border border-white/15 bg-white/[0.08] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl">

          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300">
            <Lock size={22} />
          </div>

          <div className="mb-7">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
              Password reset
            </div>

            <h1 className="text-4xl font-semibold tracking-tight">
              Create new password.
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Choose a new password for your DataInsight AI account.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-400/10 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-5 rounded-xl border border-brand-400/10 bg-brand-500/10 px-4 py-3 text-sm text-brand-300">
              {success}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-5"
          >

            <div className="grid gap-2">
              <label className="text-sm text-slate-300">
                New password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-brand-400/70 focus:ring-4 focus:ring-brand-400/10"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => !prev)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-slate-300">
                Confirm password
              </label>

              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-brand-400/70 focus:ring-4 focus:ring-brand-400/10"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirm((prev) => !prev)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-white"
                >
                  {showConfirm ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 h-12 w-full rounded-xl bg-brand-500 font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Updating password..."
                : "Reset password"}
            </button>

          </form>
        </div>
      </div>
    </main>
  );
}