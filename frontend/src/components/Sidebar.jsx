import React, { useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";

import {
  LayoutDashboard,
  MessageSquare,
  Brain,
  FileDown,
  Upload as UploadIcon,
  Plug,
  LogOut,
  Sparkles,
  SearchCode,
  Lightbulb,
  Calculator,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

import { useAuth } from "../context/AuthContext.jsx";
import { focusRing } from "./UI.jsx";

/* =========================================================
   NAVIGATION
========================================================= */

const NAV_GROUPS = (datasetId) => [
  {
    label: "Overview",
    accent: "bg-emerald-400",
    items: [
      {
        to: `/dashboard/${datasetId}`,
        label: "Dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Analysis",
    accent: "bg-sky-400",
    items: [
      {
        to: `/root-cause/${datasetId}`,
        label: "Root Cause Analysis",
        icon: SearchCode,
      },
      {
        to: `/chat/${datasetId}`,
        label: "Chat with Data",
        icon: MessageSquare,
      },
      {
        to: `/ml/${datasetId}`,
        label: "ML Studio",
        icon: Brain,
      },
      {
        to: `/what-if/${datasetId}`,
        label: "What-if Simulator",
        icon: Calculator,
      },
      {
        to: `/recommendations/${datasetId}`,
        label: "Recommendations",
        icon: Lightbulb,
      },
    ],
  },
  {
    label: "Reports",
    accent: "bg-violet-400",
    items: [
      {
        to: `/reports/${datasetId}`,
        label: "Reports",
        icon: FileDown,
        description: "View and export insights",
      },
    ],
  },
];

/* =========================================================
   SIDEBAR
========================================================= */

export default function Sidebar({
  mobileOpen = false,
  onClose,
}) {
  const { datasetId } = useParams();
  const { logout } = useAuth();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);

  const groups = datasetId ? NAV_GROUPS(datasetId) : [];

  const content = (
    <div className="h-full flex flex-col min-h-0">
      {/* =====================================================
          BRAND
      ===================================================== */}
      <Link
        to="/upload"
        onClick={onClose}
        title={collapsed ? "DataInsight AI" : undefined}
        className={`
          group flex items-center gap-3 shrink-0 mb-6
          ${collapsed ? "justify-center" : ""}
          ${focusRing}
        `}
      >
        <div
          className="
            relative w-10 h-10 min-w-10 rounded-xl
            bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-700
            flex items-center justify-center shrink-0
            shadow-[0_0_24px_rgba(16,185,129,0.18)]
          "
        >
          <Sparkles size={20} strokeWidth={2} className="text-white" />
        </div>

        <div
          className={`
            overflow-hidden min-w-0 transition-all duration-300
            ${collapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}
          `}
        >
          <div className="font-semibold text-[16px] tracking-tight text-white leading-tight truncate">
            DataInsight AI
          </div>
          <div className="text-[11px] text-slate-500 leading-tight mt-0.5 truncate">
            Intelligent Data Analytics
          </div>
        </div>
      </Link>

      {/* =====================================================
          QUICK ACTIONS
      ===================================================== */}
      <div className="flex flex-col gap-2 mb-7 shrink-0">
        <Link
          to="/upload"
          onClick={onClose}
          title={collapsed ? "New Upload" : undefined}
          className={`
            group flex items-center gap-3
            rounded-xl px-3.5 py-3
            text-sm font-medium
            bg-gradient-to-r from-emerald-500/15 to-teal-500/10
            text-emerald-400
            border border-emerald-500/10
            hover:from-emerald-500/20 hover:to-teal-500/15
            hover:border-emerald-400/20
            hover:text-emerald-300
            transition-all duration-200
            ${collapsed ? "justify-center" : ""}
            ${focusRing}
          `}
        >
          <UploadIcon size={17} className="shrink-0" />
          <span
            className={`
              whitespace-nowrap overflow-hidden transition-all duration-300
              ${collapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100"}
            `}
          >
            New Upload
          </span>
        </Link>

        <Link
          to="/connectors"
          onClick={onClose}
          title={collapsed ? "Connect Data" : undefined}
          className={`
            group flex items-center gap-3
            rounded-xl px-3.5 py-3
            text-sm
            border border-slate-800/80
            transition-all duration-200
            ${
              location.pathname === "/connectors"
                ? "bg-slate-800/80 text-white border-slate-700"
                : "text-slate-400 hover:bg-slate-900/80 hover:text-slate-200 hover:border-slate-700"
            }
            ${collapsed ? "justify-center" : ""}
            ${focusRing}
          `}
        >
          <Plug size={17} className="shrink-0 text-violet-400" />
          <span
            className={`
              whitespace-nowrap overflow-hidden transition-all duration-300
              ${collapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100"}
            `}
          >
            Connect Data
          </span>

          {!collapsed && (
            <ArrowRight
              size={14}
              className="ml-auto text-slate-600 group-hover:text-slate-400 transition"
            />
          )}
        </Link>
      </div>

      {/* =====================================================
          NAVIGATION
      ===================================================== */}
      <nav
        className="
          flex-1 min-h-0 overflow-y-auto overflow-x-hidden
          pr-1 scrollbar-thin scrollbar-thumb-slate-800
          scrollbar-track-transparent
        "
      >
        <div className="flex flex-col gap-7">
          {groups.map((group) => (
            <div key={group.label}>
              {/* Section heading */}
              <div
                className={`
                  flex items-center gap-3 px-3 mb-3
                  ${collapsed ? "justify-center" : ""}
                `}
              >
                <span
                  className={`
                    text-[10px] uppercase tracking-[0.14em]
                    font-semibold text-slate-600 whitespace-nowrap
                    transition-all duration-300
                    ${
                      collapsed
                        ? "max-w-0 opacity-0 overflow-hidden"
                        : "max-w-[100px] opacity-100"
                    }
                  `}
                >
                  {group.label}
                </span>

                {!collapsed && (
                  <div className="h-px flex-1 bg-slate-800/80 relative">
                    <span
                      className={`
                        absolute right-0 -top-[2px]
                        w-1.5 h-1.5 rounded-full ${group.accent}
                        shadow-[0_0_8px_currentColor]
                      `}
                    />
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="flex flex-col gap-1.5">
                {group.items.map(
                  ({ to, label, icon: Icon, description }) => {
                    const active = location.pathname === to;

                    return (
                      <Link
                        key={to}
                        to={to}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? label : undefined}
                        className={`
                          group relative flex items-center gap-3
                          rounded-xl px-3 py-3
                          transition-all duration-200
                          ${collapsed ? "justify-center" : ""}
                          ${
                            active
                              ? `
                                bg-gradient-to-r from-indigo-500/20
                                via-blue-500/15 to-emerald-400/10
                                border border-blue-400/25
                                text-white
                                shadow-[0_8px_30px_rgba(59,130,246,0.08)]
                              `
                              : `
                                border border-transparent
                                text-slate-400
                                hover:bg-slate-900/80
                                hover:border-slate-800
                                hover:text-slate-200
                              `
                          }
                          ${focusRing}
                        `}
                      >
                        {active && (
                          <span
                            className="
                              absolute right-0 top-1/2 -translate-y-1/2
                              w-1 h-8 rounded-l-full
                              bg-gradient-to-b from-emerald-400 to-teal-400
                              shadow-[0_0_12px_rgba(52,211,153,0.55)]
                            "
                          />
                        )}

                        <div
                          className={`
                            w-9 h-9 min-w-9 rounded-xl
                            flex items-center justify-center
                            transition-all duration-200
                            ${
                              active
                                ? "bg-emerald-400/10"
                                : "bg-slate-900/60 group-hover:bg-slate-800"
                            }
                          `}
                        >
                          <Icon
                            size={17}
                            strokeWidth={1.8}
                            className={`
                              shrink-0 transition-colors
                              ${
                                active
                                  ? "text-emerald-400"
                                  : "text-slate-500 group-hover:text-slate-300"
                              }
                            `}
                          />
                        </div>

                        <div
                          className={`
                            min-w-0 overflow-hidden transition-all duration-300
                            ${
                              collapsed
                                ? "max-w-0 opacity-0"
                                : "max-w-[180px] opacity-100"
                            }
                          `}
                        >
                          <div
                            className={`
                              text-sm font-medium whitespace-nowrap truncate
                              ${active ? "text-white" : ""}
                            `}
                          >
                            {label}
                          </div>

                          {description && !collapsed && (
                            <div className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap truncate">
                              {description}
                            </div>
                          )}
                        </div>

                        {!collapsed && !description && !active && (
                          <ChevronRight
                            size={14}
                            className="
                              ml-auto shrink-0
                              text-slate-700
                              group-hover:text-slate-500
                              transition
                            "
                          />
                        )}

                        {!collapsed && description && (
                          <ChevronRight
                            size={15}
                            className="
                              ml-auto shrink-0
                              text-slate-600
                              group-hover:text-slate-400
                              transition
                            "
                          />
                        )}
                      </Link>
                    );
                  }
                )}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* =====================================================
          FOOTER
      ===================================================== */}
      <div className="shrink-0 mt-4 pt-3 border-t border-slate-800/80">
        <div
          className={`
            flex items-center gap-2
            ${collapsed ? "flex-col" : ""}
          `}
        >
          {/* Collapse */}
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`
              flex items-center justify-center
              h-9 rounded-lg
              text-slate-500 hover:text-slate-200
              hover:bg-slate-900
              transition-all duration-200
              ${collapsed ? "w-full" : "w-full"}
              ${focusRing}
            `}
          >
            {collapsed ? (
              <ChevronRight size={17} strokeWidth={1.8} />
            ) : (
              <ChevronLeft size={17} strokeWidth={1.8} />
            )}
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            title="Log out"
            aria-label="Log out"
            className={`
              flex items-center justify-center
              h-9 rounded-lg
              text-slate-500 hover:text-red-400
              hover:bg-red-500/5
              transition-all duration-200
              ${collapsed ? "w-full" : "w-full"}
              ${focusRing}
            `}
          >
            <LogOut size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* =====================================================
          DESKTOP SIDEBAR
      ===================================================== */}
      <aside
        className={`
          relative shrink-0 hidden md:flex flex-col
          bg-[#07090d]
          border-r border-slate-800/60
          p-3 pt-5
          overflow-hidden
          transition-[width]
          duration-300 ease-in-out
          ${collapsed ? "w-20" : "w-[270px]"}
        `}
      >
        {content}
      </aside>

      {/* =====================================================
          MOBILE SIDEBAR
      ===================================================== */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          <aside
            className="
              relative z-10 w-72 h-full shrink-0
              flex flex-col
              bg-[#07090d]
              border-r border-slate-800/60
              p-3 pt-5
              overflow-hidden
              shadow-2xl
            "
          >
            <button
              onClick={onClose}
              aria-label="Close menu"
              title="Close menu"
              className={`
                absolute top-3 right-3
                w-8 h-8 rounded-lg
                flex items-center justify-center
                text-slate-500
                hover:bg-slate-800
                hover:text-white
                transition
                ${focusRing}
              `}
            >
              <X size={16} />
            </button>

            {content}
          </aside>
        </div>
      )}
    </>
  );
}