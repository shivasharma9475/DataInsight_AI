
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileSpreadsheet,
  Clock,
  Trash2,
} from "lucide-react";
import { datasetApi } from "../services/api.js";
import { Card, EmptyState } from "../components/UI.jsx";
import FluidUploadCircle from "../components/FluidUploadCircle.jsx";

export default function Upload() {
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  const inputRef = useRef(null);
  const uploadLockRef = useRef(false);

  const navigate = useNavigate();

  useEffect(() => {
    datasetApi.history()
      .then((r) => setHistory(r.data))
      .catch((err) => console.error("History loading failed:", err));
  }, []);

  // Open file picker only from a direct user click.
  const openFilePicker = useCallback(() => {
    if (uploadLockRef.current) return;
    inputRef.current?.click();
  }, []);

  const handleFile = useCallback(
    async (file) => {
      if (!file || uploadLockRef.current) return;

      const ext = file.name.split(".").pop()?.toLowerCase();

      if (!["csv", "xlsx", "xls"].includes(ext)) {
        setError("Please upload a .csv, .xlsx or .xls file.");
        return;
      }

      // Prevent multiple simultaneous upload requests.
      uploadLockRef.current = true;

      setError("");
      setPhase("uploading");
      setProgress(0);

      try {
        const res = await datasetApi.upload(file, (evt) => {
          if (evt.total) {
            setProgress(
              Math.round((evt.loaded * 100) / evt.total)
            );
          }
        });

        setProgress(100);
        setPhase("success");

        setTimeout(() => {
          navigate(`/dashboard/${res.data.dataset_id}`);
        }, 700);

      } catch (err) {
        console.error("[DATASET_UPLOAD_FAILED]", {
          status: err.response?.status,
          response: err.response?.data,
          message: err.message,
        });

        if (err.response?.status === 429) {
          setError(
            "Too many upload requests. Please wait a few minutes and try again."
          );
        } else {
          setError(
            err.response?.data?.detail ||
            "Upload failed. Please try again."
          );
        }

        setPhase("idle");
      } finally {
        uploadLockRef.current = false;
      }
    },
    [navigate]
  );

  const handleDelete = async (datasetId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this dataset?\n\nThis will permanently delete the dataset and its history."
    );

    if (!confirmed) return;

    try {
      await datasetApi.delete(datasetId);

      setHistory((prev) =>
        prev.filter((d) => d.dataset_id !== datasetId)
      );
    } catch (err) {
      console.error("Delete failed:", err);

      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Failed to delete dataset. Please try again."
      );
    }
  };

  const uploading = phase !== "idle";

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">
        Upload a dataset
      </h1>

      <p className="text-slate-400 text-sm mb-8">
        CSV or Excel, up to 50MB. We'll detect the schema automatically.
      </p>

      <div
        onDragOver={(e) => {
          if (uploading) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);

          if (uploading) return;

          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`glass rounded-2xl border-2 border-dashed transition p-14 flex flex-col items-center text-center ${
          uploading ? "cursor-default" : "cursor-default"
        } ${
          dragOver
            ? "border-brand-500 bg-brand-500/5"
            : "border-slate-700"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];

            handleFile(file);

            // Allows selecting the same file again.
            e.target.value = "";
          }}
        />

        <FluidUploadCircle
          phase={phase}
          progress={progress}
          onClick={openFilePicker}
        />

        <div className="text-slate-200 font-medium mt-5 mb-1">
          {phase === "uploading"
            ? `Uploading & analyzing... ${progress}%`
            : phase === "success"
            ? "Done!"
            : "Drag & drop your file here"}
        </div>

        {phase === "idle" && (
          <>
            <div className="text-slate-500 text-sm mb-3">
              or click below to browse — .csv, .xlsx, .xls
            </div>

            <button
              type="button"
              onClick={openFilePicker}
              className="text-sm text-brand-400 hover:text-brand-300 font-medium"
            >
              Browse files
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-lg mt-4">
          {error}
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Clock size={15} />
          Upload history
        </h2>

        <Card>
          {history.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="No datasets yet"
              desc="Upload your first file to see it here."
            />
          ) : (
            <div className="divide-y divide-slate-800">
              {history.map((d) => (
                <div
                  key={d.dataset_id}
                  className="flex items-center justify-between py-3 px-2 -mx-2 rounded-lg hover:bg-slate-800/40 transition"
                >
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/dashboard/${d.dataset_id}`)
                    }
                    className="flex items-center gap-3 text-left min-w-0 flex-1"
                  >
                    <FileSpreadsheet
                      size={18}
                      className="text-brand-400 shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">
                        {d.filename}
                      </div>

                      <div className="text-xs text-slate-500">
                        {d.row_count.toLocaleString()} rows × {d.column_count} cols

                        {d.is_cleaned && (
                          <span className="ml-2 text-emerald-400">
                            • cleaned
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <div className="text-xs text-slate-500">
                      {new Date(d.uploaded_at).toLocaleDateString()}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(d.dataset_id)}
                      title="Delete dataset"
                      className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
