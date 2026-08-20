import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const videoRef = useRef(null);
  const nameRef = useRef(null);

  const { signup } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    const reveal = () => {
      setRevealed(true);

      setTimeout(() => {
        nameRef.current?.focus();
      }, 850);
    };

    video.addEventListener("ended", reveal);
    video.addEventListener("error", reveal);

    video.play().catch(reveal);

    return () => {
      video.removeEventListener("ended", reveal);
      video.removeEventListener("error", reveal);
    };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signup(name, email, password);
      navigate("/upload");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        "Signup failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-black text-white ${
        revealed ? "is-lit" : ""
      }`}
    >
      {/* Lighthouse background */}
      <div className="absolute inset-0 overflow-hidden">
        <video
          ref={videoRef}
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
        >
          <source src="/nprv.mp4" type="video/mp4" />
        </video>

        <div
          className={`absolute inset-0 transition-all duration-700 ${
            revealed ? "bg-black/50" : "bg-black/20"
          }`}
        />
      </div>

      {/* Light sweep */}
      <div
        className={`pointer-events-none absolute left-[-20%] top-[18%] z-10 h-[64%] w-[140%] skew-x-[-11deg] bg-gradient-to-r from-brand-400/30 via-brand-400/10 to-transparent blur-3xl ${
          revealed ? "animate-light-sweep" : "opacity-0"
        }`}
      />

      {/* Signup card */}
      <section
        className={`absolute inset-0 z-20 flex min-h-screen items-center justify-end px-6 py-16 md:px-[7vw] ${
          revealed
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        } transition-opacity duration-500`}
      >
        <div
          className={`w-full max-w-[400px] rounded-[28px] border border-white/15 bg-white/[0.08] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl ${
            revealed ? "animate-login-card" : ""
          }`}
        >
          {/* Heading */}
          <div className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
            <span className="h-px w-6 bg-brand-300" />
            Get started
          </div>

          <h1 className="text-4xl font-semibold tracking-tight">
            Create account.
          </h1>

          <p className="mt-3 mb-7 text-sm leading-6 text-slate-400">
            Start turning your datasets into actionable insights.
          </p>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-400/10 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
          >
            {/* Name */}
            <div className="grid gap-2">
              <label className="text-sm text-slate-300">
                Full name
              </label>

              <input
                ref={nameRef}
                type="text"
                required
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-brand-400/70 focus:bg-black/40 focus:ring-4 focus:ring-brand-400/10"
              />
            </div>

            {/* Email */}
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

            {/* Password */}
            <div className="grid gap-2">
              <label className="text-sm text-slate-300">
                Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-brand-400/70 focus:bg-black/40 focus:ring-4 focus:ring-brand-400/10"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => !prev)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-xl bg-brand-500 font-semibold text-slate-950 shadow-[0_14px_34px_rgba(16,185,129,0.15)] transition hover:-translate-y-0.5 hover:bg-brand-400 hover:shadow-[0_18px_40px_rgba(16,185,129,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Creating account..."
                : "Create account"}
            </button>
          </form>

          {/* Login link */}
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-brand-300 transition hover:text-brand-200 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* Animation */}
      <style>{`
        @keyframes light-sweep {
          0% {
            opacity: 0;
            transform: translateX(-34%) skewX(-11deg);
          }

          32% {
            opacity: 0.75;
          }

          100% {
            opacity: 0;
            transform: translateX(62%) skewX(-11deg);
          }
        }

        @keyframes login-card {
          0% {
            opacity: 0;
            transform: translateY(28px) scale(0.94);
            filter: blur(8px);
          }

          58% {
            opacity: 1;
            transform: translateY(-4px) scale(1.012);
            filter: blur(0);
          }

          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        .animate-light-sweep {
          animation: light-sweep 900ms ease-out both;
        }

        .animate-login-card {
          animation: login-card 850ms cubic-bezier(0.16, 1, 0.3, 1) 180ms forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-light-sweep,
          .animate-login-card {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}