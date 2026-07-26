import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, FileSpreadsheet, Loader2, Clock } from "lucide-react";
import { datasetApi } from "../services/api.js";
import { Card, EmptyState } from "../components/UI.jsx";

export default function Upload() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    datasetApi.history().then((r) => setHistory(r.data)).catch(() => {});
  }, []);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      const ext = file.name.split(".").pop().toLowerCase();
      if (!["csv", "xlsx", "xls"].includes(ext)) {
        setError("Please upload a .csv or .xlsx file.");
        return;
      }
      setError("");
      setUploading(true);
      setProgress(0);
      try {
        const res = await datasetApi.upload(file, (evt) => {
          setProgress(Math.round((evt.loaded * 100) / evt.total));
        });
        navigate(`/dashboard/${res.data.dataset_id}`);
      } catch (err) {
        setError(err.response?.data?.detail || "Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [navigate]
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Upload a dataset</h1>
      <p className="text-slate-400 text-sm mb-8">CSV or Excel, up to 50MB. We'll detect the schema automatically.</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`glass rounded-2xl border-2 border-dashed transition cursor-pointer p-14 flex flex-col items-center text-center ${
          dragOver ? "border-brand-500 bg-brand-500/5" : "border-slate-700"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {uploading ? (
          <>
            <Loader2 className="animate-spin text-brand-400 mb-4" size={36} />
            <div className="text-slate-300 font-medium">Uploading & analyzing... {progress}%</div>
            <div className="w-64 h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </>
        ) : (
          <>
            <UploadCloud className="text-brand-400 mb-4" size={36} />
            <div className="text-slate-200 font-medium mb-1">Drag & drop your file here</div>
            <div className="text-slate-500 text-sm">or click to browse — .csv, .xlsx, .xls</div>
          </>
        )}
      </div>

      {error && <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-lg mt-4">{error}</div>}

      <div className="mt-10">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Clock size={15} /> Upload history
        </h2>
        <Card>
          {history.length === 0 ? (
            <EmptyState icon={FileSpreadsheet} title="No datasets yet" desc="Upload your first file to see it here." />
          ) : (
            <div className="divide-y divide-slate-800">
              {history.map((d) => (
                <button
                  key={d.dataset_id}
                  onClick={() => navigate(`/dashboard/${d.dataset_id}`)}
                  className="w-full flex items-center justify-between py-3 text-left hover:bg-slate-800/40 px-2 -mx-2 rounded-lg transition"
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet size={18} className="text-brand-400" />
                    <div>
                      <div className="text-sm font-medium text-slate-200">{d.filename}</div>
                      <div className="text-xs text-slate-500">
                        {d.row_count.toLocaleString()} rows × {d.column_count} cols
                        {d.is_cleaned && <span className="ml-2 text-emerald-400">• cleaned</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">{new Date(d.uploaded_at).toLocaleDateString()}</div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
