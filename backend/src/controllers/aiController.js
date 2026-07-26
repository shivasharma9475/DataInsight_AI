import mlClient from "../services/mlClient.js";
import { getOwnedDataset } from "./datasetController.js";
import { enhanceWithOpenAI } from "../services/aiEnhancer.js";
import { aiEnabled } from "../config/env.js";

export async function insights(req, res, next) {
  try {
    await getOwnedDataset(req.params.datasetId, req.userId);
    const { data } = await mlClient.get(`/ai/${req.params.datasetId}/insights`);

    let summary = data.summary;
    let enhanced = false;

    if (aiEnabled()) {
      const context = `Findings: ${data.insights.map((i) => i.title).join("; ")}`;
      const polished = await enhanceWithOpenAI(
        "Write a 3-4 sentence executive summary and then 3 concrete business recommendations.",
        context
      );
      if (polished) {
        summary = polished;
        enhanced = true;
      }
    }

    res.json({ insights: data.insights, summary, ai_enhanced: enhanced });
  } catch (err) {
    next(err);
  }
}

export async function rootCause(req, res, next) {
  try {
    const {
      dataset_id,
      date_column,
      metric_column,
      dimension_columns = [],
      period = "M",
    } = req.body;

    // Verify that this dataset belongs to the authenticated user
    await getOwnedDataset(dataset_id, req.userId);

    const { data } = await mlClient.post(
      "/analysis/root-cause",
      {
        dataset_id,
        date_column,
        metric_column,
        dimension_columns,
        period,
      }
    );

    return res.json(data);
  } catch (err) {
    next(err);
  }
}
