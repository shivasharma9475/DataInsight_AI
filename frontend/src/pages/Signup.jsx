import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(name, email, password);
      navigate("/upload");
    } catch (err) {
      setError(err.response?.data?.detail || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-grid-glow flex items-center justify-center px-4">
      <div className="w-full max-w-sm glass rounded-2xl p-8">
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="font-semibold text-lg">DataInsight AI</span>
        </Link>
        <h1 className="text-xl font-semibold mb-1">Create your account</h1>
        <p className="text-sm text-slate-400 mb-6">Start turning spreadsheets into insights.</p>

        {error && <div className="bg-red-500/10 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <input
            type="text" required placeholder="Full name" value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500"
          />
          <input
            type="email" required placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500"
          />
          <input
            type="password" required minLength={6} placeholder="Password (min 6 characters)" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500"
          />
          <button
            type="submit" disabled={loading}
            className="bg-brand-600 hover:bg-brand-500 transition rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-sm text-slate-400 mt-6 text-center">
          Already have an account? <Link to="/login" className="text-brand-400 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
