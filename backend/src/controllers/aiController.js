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
  comparison_mode = "full",
} = req.body;

console.log("[NODE RCA DEBUG]", {
  dataset_id,
  date_column,
  metric_column,
  dimension_columns,
  period,
  comparison_mode,
});

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
    comparison_mode,
  }
);

    return res.json(data);
  } catch (err) {
    next(err);
  }
}


export async function copilotQuery(req, res, next) {
  try {
    const {
      dataset_id,
      tool,
      arguments: toolArguments = {},
    } = req.body;

    if (!dataset_id) {
      return res.status(400).json({
        message: "dataset_id is required",
      });
    }

    if (!tool) {
      return res.status(400).json({
        message: "tool is required",
      });
    }

    if (
      typeof toolArguments !== "object" ||
      toolArguments === null ||
      Array.isArray(toolArguments)
    ) {
      return res.status(400).json({
        message: "arguments must be an object",
      });
    }

    // Security: make sure dataset belongs to logged-in user.
    await getOwnedDataset(
      dataset_id,
      req.userId
    );

    const { data } = await mlClient.post(
      "/copilot/query",
      {
        dataset_id,
        tool,
        arguments: toolArguments,
      }
    );

    return res.json(data);
  } catch (err) {
    next(err);
  }
}