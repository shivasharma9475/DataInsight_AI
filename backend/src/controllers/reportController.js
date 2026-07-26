import mlClient from "../services/mlClient.js";
import { getOwnedDataset } from "./datasetController.js";

export async function excelReport(req, res, next) {
  try {
    const doc = await getOwnedDataset(req.params.datasetId, req.userId);
    const response = await mlClient.get(`/reports/${req.params.datasetId}/excel`, { responseType: "arraybuffer" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${doc.filename}_report.xlsx"`);
    res.send(Buffer.from(response.data));
  } catch (err) {
    next(err);
  }
}

export async function pdfReport(req, res, next) {
  try {
    const doc = await getOwnedDataset(req.params.datasetId, req.userId);
    const response = await mlClient.get(`/reports/${req.params.datasetId}/pdf`, {
      params: { filename: doc.filename },
      responseType: "arraybuffer",
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${doc.filename}_report.pdf"`);
    res.send(Buffer.from(response.data));
  } catch (err) {
    next(err);
  }
}
