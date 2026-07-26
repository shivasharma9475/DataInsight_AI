import React from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Brain, FileDown, Upload as UploadIcon, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function Sidebar() {
  const { datasetId } = useParams();
  const { user, logout } = useAuth();
  const location = useLocation();

  const items = datasetId
    ? [
        { to: `/dashboard/${datasetId}`, label: "Dashboard", icon: LayoutDashboard },
        { to: `/chat/${datasetId}`, label: "Chat with Data", icon: MessageSquare },
        { to: `/ml/${datasetId}`, label: "ML Studio", icon: Brain },
        { to: `/reports/${datasetId}`, label: "Reports", icon: FileDown },
      ]
    : [];

  return (
    <aside className="w-64 shrink-0 hidden md:flex flex-col glass border-r border-slate-800 p-5">
      <Link to="/upload" className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
          <Sparkles size={18} className="text-white" />
        </div>
        <span className="font-semibold text-lg tracking-tight">DataInsight AI</span>
      </Link>

      <Link
        to="/upload"
        className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg mb-4 bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 transition"
      >
        <UploadIcon size={16} /> New Upload
      </Link>

      <nav className="flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-xs font-semibold">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="text-xs">
            <div className="text-slate-200 font-medium truncate max-w-[140px]">{user?.name}</div>
            <div className="text-slate-500 truncate max-w-[140px]">{user?.email}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 transition"
        >
          <LogOut size={15} /> Log out
        </button>
      </div>
    </aside>
  );
}
