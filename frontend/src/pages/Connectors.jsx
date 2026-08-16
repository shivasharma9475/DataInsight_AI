import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plug,
  Globe,
  Database,
  Table2,
  Sheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { connectorApi } from "../services/api.js";
import { Card, EmptyState } from "../components/UI.jsx";

const CONNECTOR_TYPES = [
  { id: "rest", label: "REST API", icon: Globe, desc: "Import JSON from an HTTP endpoint" },
  { id: "mysql", label: "MySQL", icon: Database, desc: "Read-only table import" },
  { id: "postgres", label: "PostgreSQL", icon: Database, desc: "Read-only table import" },
  { id: "google_sheets", label: "Google Sheets", icon: Sheet, desc: "Public/link-shared sheets only" },
];

const EMPTY_CONFIG = {
  rest: { url: "", authToken: "" },
  mysql: { host: "", port: "3306", user: "", password: "", database: "" },
  postgres: { host: "", port: "5432", user: "", password: "", database: "", schema: "public" },
  google_sheets: { url: "" },
};

function buildConfig(type, form) {
  if (type === "rest") {
    const config = { url: form.url };
    if (form.authToken) {
      config.headers = { Authorization: `Bearer ${form.authToken}` };
    }
    return config;
  }
  if (type === "mysql" || type === "postgres") {
    const config = {
      host: form.host,
      port: form.port ? Number(form.port) : undefined,
      user: form.user,
      password: form.password,
      database: form.database,
    };
    if (type === "postgres" && form.schema) config.schema = form.schema;
    return config;
  }
  if (type === "google_sheets") {
    return { url: form.url };
  }
  return {};
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-1 focus:ring-brand-500";

export default function Connectors() {
  const navigate = useNavigate();
  const [type, setType] = useState("rest");
  const [forms, setForms] = useState(EMPTY_CONFIG);

  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [testResult, setTestResult] = useState(null); // { resources: [] }

  const [selectedResource, setSelectedResource] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  const form = forms[type];

  function updateField(field, value) {
    setForms((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  }

  function switchType(nextType) {
    setType(nextType);
    setTestResult(null);
    setTestError("");
    setImportError("");
    setSelectedResource("");
  }

  async function handleTest() {
    setTesting(true);
    setTestError("");
    setTestResult(null);
    setImportError("");
    setSelectedResource("");
    try {
      const config = buildConfig(type, form);
      const res = await connectorApi.test({ type, config });
      const resources = res.data?.result?.resources || [];
      setTestResult({ resources });
      if (resources.length === 1) setSelectedResource(resources[0]);
    } catch (err) {
      setTestError(
        err.response?.data?.detail ||
          "Could not connect. Please check your connection details."
      );
    } finally {
      setTesting(false);
    }
  }

  async function handleImport() {
    if (!selectedResource) return;
    setImporting(true);
    setImportError("");
    try {
      const config = buildConfig(type, form);
      const res = await connectorApi.import({
        type,
        config,
        resource: selectedResource,
      });
      navigate(`/dashboard/${res.data.dataset_id}`);
    } catch (err) {
      setImportError(
        err.response?.data?.detail ||
          "Import failed. Please check your connection details and selected resource."
      );
    } finally {
      setImporting(false);
    }
  }

  const resourceLabel =
    type === "mysql" || type === "postgres" ? "table" : "resource";

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2">
        <Plug className="text-brand-400" size={22} /> Connectors
      </h1>
      <p className="text-slate-400 text-sm mb-6">
        Import data from a live source. Credentials are used only for this
        import and are never stored.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {CONNECTOR_TYPES.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => switchType(id)}
            className={`glass rounded-xl p-4 text-left transition ${
              type === id ? "ring-2 ring-brand-500" : "hover:bg-slate-800/40"
            }`}
          >
            <Icon size={18} className="text-brand-400 mb-2" />
            <div className="text-sm font-medium text-slate-200">{label}</div>
            <div className="text-xs text-slate-500">{desc}</div>
          </button>
        ))}
      </div>

      {type === "google_sheets" && (
        <div className="bg-amber-500/10 text-amber-300 text-xs px-4 py-3 rounded-lg mb-6">
          Only public / "Anyone with the link can view" sheets are supported
          right now. Private sheets requiring Google sign-in aren't
          supported in this version.
        </div>
      )}

      <Card className="mb-6">
        <div className="grid sm:grid-cols-2 gap-4">
          {type === "rest" && (
            <>
              <div className="sm:col-span-2">
                <Field label="Endpoint URL">
                  <input
                    className={inputClass}
                    placeholder="https://api.example.com/sales"
                    value={form.url}
                    onChange={(e) => updateField("url", e.target.value)}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Bearer token (optional)">
                  <input
                    type="password"
                    className={inputClass}
                    placeholder="Only sent for this import, never stored"
                    value={form.authToken}
                    onChange={(e) => updateField("authToken", e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}

          {(type === "mysql" || type === "postgres") && (
            <>
              <Field label="Host">
                <input
                  className={inputClass}
                  placeholder="db.example.com"
                  value={form.host}
                  onChange={(e) => updateField("host", e.target.value)}
                />
              </Field>
              <Field label="Port">
                <input
                  className={inputClass}
                  value={form.port}
                  onChange={(e) => updateField("port", e.target.value)}
                />
              </Field>
              <Field label="Database">
                <input
                  className={inputClass}
                  value={form.database}
                  onChange={(e) => updateField("database", e.target.value)}
                />
              </Field>
              {type === "postgres" && (
                <Field label="Schema">
                  <input
                    className={inputClass}
                    value={form.schema}
                    onChange={(e) => updateField("schema", e.target.value)}
                  />
                </Field>
              )}
              <Field label="User">
                <input
                  className={inputClass}
                  value={form.user}
                  onChange={(e) => updateField("user", e.target.value)}
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  className={inputClass}
                  placeholder="Only sent for this import, never stored"
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2 text-xs text-slate-500">
                Use a read-only database user if possible. Only table
                <span className="text-slate-400"> SELECT</span> is ever
                performed — no other SQL is executed.
              </div>
            </>
          )}

          {type === "google_sheets" && (
            <div className="sm:col-span-2">
              <Field label="Sheet URL">
                <input
                  className={inputClass}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  value={form.url}
                  onChange={(e) => updateField("url", e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            {testing ? <Loader2 size={15} className="animate-spin" /> : <Plug size={15} />}
            {testing ? "Testing connection..." : "Test connection"}
          </button>

          {testResult && !testError && (
            <span className="flex items-center gap-1.5 text-emerald-400 text-xs">
              <CheckCircle2 size={14} /> Connected
            </span>
          )}
        </div>

        {testError && (
          <div className="mt-4 flex items-start gap-2 bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-lg">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{testError}</span>
          </div>
        )}
      </Card>

      {testResult && !testError && (
        <Card title={`Select a ${resourceLabel} to import`} className="mb-6">
          {testResult.resources.length === 0 ? (
            <EmptyState
              icon={Table2}
              title="No importable data found"
              desc={`The connection succeeded, but no ${resourceLabel}s were found.`}
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {testResult.resources.map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedResource(r)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                      selectedResource === r
                        ? "border-brand-500 bg-brand-500/10 text-brand-300"
                        : "border-slate-800 text-slate-400 hover:bg-slate-800/40"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <button
                onClick={handleImport}
                disabled={!selectedResource || importing}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                {importing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ArrowRight size={15} />
                )}
                {importing ? "Importing..." : "Import & analyze"}
              </button>

              {importError && (
                <div className="mt-4 flex items-start gap-2 bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-lg">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
