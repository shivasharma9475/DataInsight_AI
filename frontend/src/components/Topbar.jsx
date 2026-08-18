import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Search,
  Bell,
  HelpCircle,
  Menu,
  CheckCircle2,
  Database,
  X,
  BookOpen,
  CircleHelp,
  MessageCircle,
  Flag,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { focusRing } from "./UI.jsx";
import { datasetApi } from "../services/api.js";
import { useNavigate } from "react-router-dom";

/*
 * Global top bar.
 * Search is connected to the backend and returns the
 * authenticated user's matching datasets.
 */
export default function TopBar({ notificationCount = 0, onMenuClick }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
const [notificationOpen, setNotificationOpen] = useState(false);
const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const searchRef = useRef(null);

  // Search effect
useEffect(() => {
  const query = searchQuery.trim();

  if (query.length < 2) {
    setSearchResults([]);
    setSearching(false);
    setSearchOpen(false);
    return;
  }

  const timer = setTimeout(async () => {
    try {
      setSearching(true);

      const response = await datasetApi.search(query);

      setSearchResults(response.data?.results || []);
      setSearchOpen(true);
    } catch (error) {
      console.error("Global search failed:", error);
      setSearchResults([]);
      setSearchOpen(true);
    } finally {
      setSearching(false);
    }
  }, 300);

  return () => clearTimeout(timer);
}, [searchQuery]);


// Notification effect
useEffect(() => {
  let mounted = true;

  const loadNotifications = async () => {
    console.log("🔔 Loading notifications...");

    try {
      setNotificationsLoading(true);

      const response = await datasetApi.notifications();

      console.log(
        "🔔 Notification API response:",
        response.data
      );

      if (mounted) {
        setNotifications(
          response.data?.notifications || []
        );
      }
    } catch (error) {
      console.error(
        "❌ Notification API failed:",
        error
      );

      console.error(
        "❌ Response:",
        error.response?.data
      );

      if (mounted) {
        setNotifications([]);
      }
    } finally {
      if (mounted) {
        setNotificationsLoading(false);
      }
    }
  };

  loadNotifications();

  return () => {
    mounted = false;
  };
}, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target)
      ) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearchResult = (result) => {
    if (!result?.route) return;

    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);

    navigate(result.route);
  };

  return (
    <header className="relative z-[100] h-14 shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 border-b border-slate-800/60 glass">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className={`md:hidden w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition ${focusRing}`}
        >
          <Menu size={18} />
        </button>

        {/* Search */}
        <div
  ref={searchRef}
  className="relative z-[110] flex-1 min-w-0 max-w-md"
>
          <div className="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-1.5">
            <Search
              size={15}
              className="text-slate-500 shrink-0"
            />

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) {
                  setSearchOpen(true);
                }
              }}
              aria-label="Search datasets"
              placeholder="Search datasets"
              autoComplete="off"
              className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none w-full min-w-0"
            />

            {searching && (
              <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-brand-400 rounded-full animate-spin shrink-0" />
            )}
          </div>

          {/* Search Dropdown */}
          {searchOpen && searchQuery.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 z-[120] overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
              
              {searching ? (
                <div className="px-4 py-3 text-sm text-slate-500">
                  Searching...
                </div>
              ) : searchResults.length > 0 ? (
                <div className="py-1">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      type="button"
                      onClick={() => handleSearchResult(result)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-900 transition"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                        <Database
                          size={15}
                          className="text-brand-400"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-200 truncate">
                          {result.title}
                        </div>

                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {result.description}
                        </div>
                      </div>

                      <span className="text-[10px] uppercase tracking-wide text-slate-600">
                        {result.type}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-4">
                  <div className="text-sm text-slate-400">
                    No results found
                  </div>

                  <div className="text-xs text-slate-600 mt-1">
                    Try searching by dataset name.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="relative">
  <button
    onClick={() => {
      setNotificationOpen((prev) => !prev);
      setHelpOpen(false);
    }}
    className={`relative w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition ${focusRing}`}
    aria-label="Notifications"
    aria-expanded={notificationOpen}
  >
    <Bell size={17} />

    {notifications.length > 0 && (
      <span className="absolute top-1.5 right-1.5 min-w-2 h-2 rounded-full bg-brand-400" />
    )}
  </button>

  {notificationOpen && (
    <div className="absolute right-0 top-full mt-2 w-80 z-[200] overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">

      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">
            Notifications
          </h3>

          {notifications.length > 0 && (
  <p className="text-[11px] text-slate-500 mt-0.5">
    {notifications.length} recent
  </p>
)}
        </div>

        {notificationCount > 0 && (
          <button
            className="text-[11px] text-brand-400 hover:text-brand-300"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notificationsLoading ? (
  <div className="px-4 py-8 text-center text-sm text-slate-500">
    Loading notifications...
  </div>
) : notifications.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <Bell
            size={28}
            className="mx-auto text-slate-700 mb-3"
          />

          <div className="text-sm text-slate-400">
            No notifications
          </div>

          <div className="text-xs text-slate-600 mt-1">
            You're all caught up.
          </div>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <div className="flex gap-3 px-4 py-3 hover:bg-slate-900 transition cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2
                size={16}
                className="text-emerald-400"
              />
            </div>

            <div className="max-h-80 overflow-y-auto">
  {notifications.map((notification) => (
    <button
      key={notification.id}
      type="button"
      onClick={() => {
        setNotificationOpen(false);

        if (notification.route) {
          navigate(notification.route);
        }
      }}
      className="w-full flex gap-3 px-4 py-3 text-left hover:bg-slate-900 transition border-b border-slate-900"
    >
      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
        {notification.type === "dataset_cleaned" ? (
          <CheckCircle2
            size={16}
            className="text-emerald-400"
          />
        ) : (
          <Database
            size={16}
            className="text-brand-400"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm text-slate-200">
          {notification.title}
        </div>

        <div className="text-xs text-slate-500 mt-1">
          {notification.message}
        </div>

        {notification.createdAt && (
          <div className="text-[10px] text-slate-600 mt-1">
            {new Date(notification.createdAt).toLocaleString()}
          </div>
        )}
      </div>
    </button>
  ))}
</div>

            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-2 shrink-0" />
          </div>
        </div>
      )}

      <div className="border-t border-slate-800">
        <button
          onClick={() => setNotificationOpen(false)}
          className="w-full px-4 py-2.5 text-xs text-brand-400 hover:bg-slate-900 transition"
        >
          Close
        </button>
      </div>
    </div>
  )}
</div>
        <div className="relative">
  <button
    onClick={() => {
      setHelpOpen((prev) => !prev);
      setNotificationOpen(false);
    }}
    className={`w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition ${focusRing}`}
    aria-label="Help"
    aria-expanded={helpOpen}
  >
    <HelpCircle size={17} />
  </button>

  {helpOpen && (
    <div className="absolute right-0 top-full mt-2 w-64 z-[200] overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">

      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-200">
          Help & Support
        </h3>

        <p className="text-xs text-slate-500 mt-1">
          Need help using DataInsight AI?
        </p>
      </div>

      <div className="p-2">

        <button
          onClick={() => {
            setHelpOpen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-slate-900 transition"
        >
          <BookOpen
            size={16}
            className="text-brand-400"
          />

          <div>
            <div className="text-sm text-slate-300">
              Quick Tour
            </div>

            <div className="text-[11px] text-slate-600">
              Learn the basics
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            setHelpOpen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-slate-900 transition"
        >
          <BookOpen
            size={16}
            className="text-sky-400"
          />

          <div>
            <div className="text-sm text-slate-300">
              Documentation
            </div>

            <div className="text-[11px] text-slate-600">
              Read platform guides
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            setHelpOpen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-slate-900 transition"
        >
          <CircleHelp
            size={16}
            className="text-violet-400"
          />

          <div>
            <div className="text-sm text-slate-300">
              FAQs
            </div>

            <div className="text-[11px] text-slate-600">
              Common questions
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            setHelpOpen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-slate-900 transition"
        >
          <MessageCircle
            size={16}
            className="text-emerald-400"
          />

          <div>
            <div className="text-sm text-slate-300">
              Contact Support
            </div>

            <div className="text-[11px] text-slate-600">
              Get help from our team
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            setHelpOpen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-slate-900 transition"
        >
          <Flag
            size={16}
            className="text-amber-400"
          />

          <div>
            <div className="text-sm text-slate-300">
              Report an Issue
            </div>

            <div className="text-[11px] text-slate-600">
              Tell us about a problem
            </div>
          </div>
        </button>

      </div>
    </div>
  )}
</div>

        <div className="w-px h-6 bg-slate-800 mx-1 hidden sm:block" />

        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-xs font-semibold text-white">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>

          <div className="text-xs hidden lg:block">
            <div className="text-slate-200 font-medium leading-tight">
              {user?.name || "User"}
            </div>

            <div className="text-slate-500 leading-tight">
              {user?.email || ""}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}