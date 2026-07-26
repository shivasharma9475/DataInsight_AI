import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { FileDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { reportApi } from "../services/api.js";
import { Card } from "../components/UI.jsx";

export default function Reports() {
  const { datasetId } = useParams();
  const [downloading, setDownloading] = useState(null);

  const download = async (type) => {
    setDownloading(type);
    try {
      if (type === "pdf") await reportApi.downloadPdf(datasetId, "datainsight_report.pdf");
      else await reportApi.downloadExcel(datasetId, "datainsight_report.xlsx");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2"><FileDown className="text-brand-400" size={22} /> Reports</h1>
      <p className="text-slate-400 text-sm mb-8">Export a shareable summary of this dataset's quality, statistics, and AI insights.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <FileText size={26} className="text-brand-400 mb-3" />
          <h3 className="font-semibold mb-1">PDF Report</h3>
          <p className="text-sm text-slate-400 mb-4">
            Executive summary, dataset overview, and AI-generated insights — ready to present.
          </p>
          <button
            onClick={() => download("pdf")}
            disabled={downloading === "pdf"}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 transition px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {downloading === "pdf" ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            Download PDF
          </button>
        </Card>

        <Card>
          <FileSpreadsheet size={26} className="text-emerald-400 mb-3" />
          <h3 className="font-semibold mb-1">Excel Workbook</h3>
          <p className="text-sm text-slate-400 mb-4">
            Raw data, column profile, and descriptive statistics across three sheets.
          </p>
          <button
            onClick={() => download("excel")}
            disabled={downloading === "excel"}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 transition px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {downloading === "excel" ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            Download Excel
          </button>
        </Card>
      </div>
    </div>
  );
}
