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

export async function recommendations(req, res, next) {
  try {
    const {
      dataset_id,
      metric_column,
      dimension_columns = [],
      max_recommendations = 20,
    } = req.body;

    // 1. Verify dataset ownership
    const doc = await getOwnedDataset(
      dataset_id,
      req.userId
    );

    // 2. Deterministic engine ALWAYS runs first
    const { data } = await mlClient.post(
      "/recommendations",
      {
        dataset_id,
        metric_column,
        dimension_columns,
        max_recommendations,
      }
    );

    let aiExplanation = null;
    let aiEnhanced = false;

    // 3. Optional OpenAI enhancement
    // Failure here must NEVER break deterministic recommendations.
    if (
      aiEnabled() &&
      data.recommendations?.length > 0
    ) {
      try {
        const context = `
Dataset: ${doc.filename}
Rows: ${doc.rowCount}

Metric:
${metric_column}

Dimensions:
${JSON.stringify(dimension_columns)}

Verified deterministic analysis:
${JSON.stringify({
  summary: data.summary,
  recommendations: data.recommendations,
})}
`;

        const polished = await enhanceWithOpenAI(
          `
Explain these verified recommendations to the user.

Rules:
- Use ONLY the supplied analysis.
- Do not invent numbers.
- Do not calculate new statistics.
- Do not change scores.
- Do not change priorities.
- Do not claim causation unless the evidence supports it.
- Highlight the most important findings first.
- Keep the explanation concise and actionable.
`,
          context
        );

        if (polished) {
          aiExplanation = polished;
          aiEnhanced = true;
        }
      } catch (error) {
        console.warn(
          "[RECOMMENDATIONS] OpenAI enhancement failed. Using deterministic result:",
          error.message
        );
      }
    }

    // 4. Deterministic recommendations are always authoritative
    return res.json({
      ...data,

      ai_explanation: aiExplanation,
      ai_enhanced: aiEnhanced,

      engine: aiEnhanced
        ? "deterministic+openai"
        : "deterministic",
    });
  } catch (err) {
    next(err);
  }
}