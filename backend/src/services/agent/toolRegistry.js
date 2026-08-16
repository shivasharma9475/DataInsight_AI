import { z } from "zod";
import mlClient from "../mlClient.js";

// =========================================================
// Per-tool timeouts (ms)
//
// Deliberately per-tool, not one aggressive global figure --
// cheap read-only tools get a short budget, ML training /
// forecasting gets enough room for cross-validation or a
// Holt-Winters + backtest fit to actually finish.
// =========================================================

export const TOOL_TIMEOUTS = {
  dataset_summary: 10_000,
  dataset_profile: 10_000,
  aggregate: 15_000,
  group_by: 15_000,
  trend: 20_000,
  root_cause: 30_000,
  recommendation: 30_000,
  what_if: 15_000,
  forecast: 60_000,
  classification: 90_000,
  regression: 90_000,
  clustering: 60_000,
  explainability: 90_000,
  data_source_info: 2_000,
};

// =========================================================
// Shared argument fragments
// =========================================================

const AGGREGATION = z.enum(["sum", "mean", "median", "min", "max", "count"]);
const PERIOD = z.enum(["D", "W", "M", "Q", "Y"]);

// =========================================================
// Tool definitions
//
// Every tool has its OWN strict argument schema. This is
// deliberate: a single generic "ml_automl" schema would need
// most fields optional (since classification/regression need
// target_column + feature_columns, but clustering/forecast
// don't), which weakens validation. Splitting the tools keeps
// bad-argument detection tight per task.
//
// `execute` never accepts anything the LLM could turn into
// arbitrary SQL/code/shell/filesystem/HTTP access -- every
// execute() below is a fixed call into an existing, already
// -tested endpoint or in-process helper. Nothing here builds a
// URL, query, or file path out of caller-supplied strings.
// =========================================================

const TOOLS = {
  dataset_summary: {
    name: "dataset_summary",
    description: "Factual overview of the dataset: row/column counts, missing values.",
    deterministic: true,
    chainable: true,
    argsSchema: z.object({}).strict(),
    execute: async ({ dataset_id }) => {
      const { data } = await mlClient.post("/copilot/query", {
        dataset_id,
        tool: "dataset_summary",
        arguments: {},
      });
      return data?.result ?? data;
    },
    extractEvidence: (result) => ({
      row_count: result?.row_count,
      column_count: result?.column_count,
      duplicate_rows: result?.duplicate_rows,
      missing_cells: result?.missing_cells,
    }),
  },

  dataset_profile: {
    name: "dataset_profile",
    description: "Column-level schema: numeric/categorical/datetime column names.",
    deterministic: true,
    chainable: true,
    argsSchema: z.object({}).strict(),
    execute: async ({ dataset_id }) => {
      const { data } = await mlClient.get(`/datasets/${dataset_id}/profile`);
      return data;
    },
    extractEvidence: (result) => ({
      row_count: result?.row_count,
      numerical_columns: result?.numerical_columns,
      categorical_columns: result?.categorical_columns,
      datetime_columns: result?.datetime_columns,
    }),
  },

  aggregate: {
    name: "aggregate",
    description: "Single aggregate (sum/mean/min/max/count) of one numeric column.",
    deterministic: true,
    chainable: true,
    argsSchema: z
      .object({
        metric_column: z.string().min(1),
        aggregation: AGGREGATION.default("sum"),
      })
      .strict(),
    execute: async ({ dataset_id, arguments: args }) => {
      const { data } = await mlClient.post("/copilot/query", {
        dataset_id,
        tool: "aggregate",
        arguments: args,
      });
      return data?.result ?? data;
    },
    extractEvidence: (result) => ({
      metric: result?.metric,
      aggregation: result?.aggregation,
      value: result?.value,
      valid_rows: result?.valid_rows,
    }),
  },

  group_by: {
    name: "group_by",
    description: "Aggregate a numeric metric broken down by a categorical dimension.",
    deterministic: true,
    chainable: true,
    argsSchema: z
      .object({
        metric_column: z.string().min(1),
        dimension_column: z.string().min(1),
        aggregation: AGGREGATION.default("sum"),
      })
      .strict(),
    execute: async ({ dataset_id, arguments: args }) => {
      const { data } = await mlClient.post("/copilot/query", {
        dataset_id,
        tool: "group_by",
        arguments: args,
      });
      return data?.result ?? data;
    },
    extractEvidence: (result) => ({
      metric: result?.metric,
      dimension: result?.dimension,
      aggregation: result?.aggregation,
      top_results: Array.isArray(result?.results) ? result.results.slice(0, 10) : undefined,
    }),
  },

  trend: {
    name: "trend",
    description: "Aggregate a metric over time (daily/weekly/monthly/quarterly/yearly).",
    deterministic: true,
    chainable: true,
    argsSchema: z
      .object({
        date_column: z.string().min(1),
        metric_column: z.string().min(1),
        period: PERIOD.default("M"),
        aggregation: AGGREGATION.default("sum"),
      })
      .strict(),
    execute: async ({ dataset_id, arguments: args }) => {
      const { data } = await mlClient.post("/copilot/query", {
        dataset_id,
        tool: "trend",
        arguments: args,
      });
      return data?.result ?? data;
    },
    extractEvidence: (result) => ({
      metric: result?.metric,
      period: result?.period,
      aggregation: result?.aggregation,
      points: Array.isArray(result?.points) ? result.points.slice(-12) : undefined,
    }),
  },

  root_cause: {
    name: "root_cause",
    description: "Explains why a metric changed between two periods, with top contributors.",
    deterministic: true,
    chainable: true,
    argsSchema: z
      .object({
        date_column: z.string().min(1),
        metric_column: z.string().min(1),
        dimension_columns: z.array(z.string().min(1)).max(10).default([]),
        period: PERIOD.default("M"),
        comparison_mode: z.enum(["full", "comparable"]).default("comparable"),
      })
      .strict(),
    execute: async ({ dataset_id, arguments: args }) => {
      const { data } = await mlClient.post("/copilot/query", {
        dataset_id,
        tool: "root_cause",
        arguments: args,
      });
      return data?.result ?? data;
    },
    extractEvidence: (result) => ({
      comparison: result?.comparison,
      top_contributors: Array.isArray(result?.top_contributors)
        ? result.top_contributors.slice(0, 5)
        : undefined,
      warning: result?.analysis_quality?.warning,
    }),
  },

  recommendation: {
    name: "recommendation",
    description: "Deterministic, evidence-based business recommendations for a metric.",
    deterministic: true,
    chainable: false,
    argsSchema: z
      .object({
        metric_column: z.string().min(1),
        dimension_columns: z.array(z.string().min(1)).max(10).default([]),
        max_recommendations: z.number().int().min(1).max(100).default(20),
      })
      .strict(),
    execute: async ({ dataset_id, arguments: args }) => {
      const { data } = await mlClient.post("/recommendations", {
        dataset_id,
        metric_column: args.metric_column,
        dimension_columns: args.dimension_columns,
        max_recommendations: args.max_recommendations,
      });
      return data;
    },
    extractEvidence: (result) => ({
      summary: result?.summary,
      recommendations: Array.isArray(result?.recommendations)
        ? result.recommendations.slice(0, 10)
        : undefined,
    }),
  },

  what_if: {
    name: "what_if",
    description:
      "Deterministic scenario simulation: projected impact of changing a metric by a percentage. " +
      "Accepts EITHER structured arguments OR a natural-language `question` (the existing hybrid " +
      "What-if engine parses the question itself -- this tool never parses natural language here).",
    deterministic: true,
    chainable: false,
    argsSchema: z.union([
      z.object({ question: z.string().min(1) }).strict(),
      z
        .object({
          metric_column: z.string().min(1),
          dimension_column: z.string().min(1).optional(),
          segment_value: z.string().min(1).optional(),
          change_percentage: z.number(),
        })
        .strict(),
    ]),
    execute: async ({ dataset_id, arguments: args }) => {
      const payload =
        "question" in args
          ? { dataset_id, question: args.question }
          : {
              dataset_id,
              metric_column: args.metric_column,
              dimension_column: args.dimension_column || null,
              segment_value: args.segment_value ?? null,
              change_percentage: args.change_percentage,
            };
      const { data } = await mlClient.post("/what-if", payload);
      return data?.result ?? data;
    },
    extractEvidence: (result) => ({
      scenario_type: result?.scenario_type,
      baseline_total: result?.baseline_total,
      projected_total: result?.projected_total,
      baseline_segment: result?.baseline_segment,
      projected_segment: result?.projected_segment,
      change_percentage: result?.change_percentage,
      planner: result?.planner,
      ai_used: result?.ai_used,
    }),
  },

  forecast: {
    name: "forecast",
    description: "Forecast a metric forward in time using Holt-Winters or a linear fallback.",
    deterministic: true,
    chainable: false,
    argsSchema: z
      .object({
        date_column: z.string().min(1),
        metric_column: z.string().min(1),
        periods: z.number().int().min(1).max(730).default(30),
      })
      .strict(),
    execute: async ({ dataset_id, arguments: args }) => {
      const { data } = await mlClient.post("/ml/run", {
        dataset_id,
        task: "forecasting",
        date_column: args.date_column,
        target_column: args.metric_column,
        periods: args.periods,
      });
      return data;
    },
    extractEvidence: (result) => ({
      method: result?.method,
      trend_direction: result?.trend_direction,
      pct_change_projected: result?.pct_change_projected,
      forecast: result?.forecast,
      evaluation: result?.evaluation,
      confidence_interval: result?.confidence_interval,
      warnings: result?.warnings,
    }),
  },

  classification: {
    name: "classification",
    description: "Train/evaluate classification models for a target column.",
    deterministic: true,
    chainable: true,
    argsSchema: z
      .object({
        target_column: z.string().min(1),
        feature_columns: z.array(z.string().min(1)).min(1),
        algorithm: z
          .enum(["logistic_regression", "decision_tree", "random_forest", "xgboost"])
          .optional(),
      })
      .strict(),
    execute: async ({ dataset_id, arguments: args }) => {
      const { data } = await mlClient.post("/ml/run", {
        dataset_id,
        task: "classification",
        target_column: args.target_column,
        feature_columns: args.feature_columns,
        algorithm: args.algorithm,
      });
      return data;
    },
    extractEvidence: (result) => ({
      best_model: result?.best_model,
      best_score: result?.best_score,
      models_tried: result?.models_tried ? Object.keys(result.models_tried) : undefined,
      feature_importance: result?.feature_importance,
      warnings: result?.warnings,
    }),
  },

  regression: {
    name: "regression",
    description: "Train/evaluate regression models for a target column.",
    deterministic: true,
    chainable: true,
    argsSchema: z
      .object({
        target_column: z.string().min(1),
        feature_columns: z.array(z.string().min(1)).min(1),
        algorithm: z
          .enum(["linear_regression", "random_forest", "gradient_boosting"])
          .optional(),
      })
      .strict(),
    execute: async ({ dataset_id, arguments: args }) => {
      const { data } = await mlClient.post("/ml/run", {
        dataset_id,
        task: "regression",
        target_column: args.target_column,
        feature_columns: args.feature_columns,
        algorithm: args.algorithm,
      });
      return data;
    },
    extractEvidence: (result) => ({
      best_model: result?.best_model,
      best_score: result?.best_score,
      models_tried: result?.models_tried ? Object.keys(result.models_tried) : undefined,
      feature_importance: result?.feature_importance,
      warnings: result?.warnings,
    }),
  },

  clustering: {
    name: "clustering",
    description: "Cluster rows using unsupervised learning over a set of feature columns.",
    deterministic: true,
    chainable: true,
    // Deliberately NO target_column field here -- clustering is
    // unsupervised. If a planner tries to smuggle one in, .strict()
    // rejects the whole call rather than silently dropping it.
    argsSchema: z
      .object({
        feature_columns: z.array(z.string().min(1)).min(1),
        algorithm: z.enum(["kmeans", "dbscan"]).optional(),
      })
      .strict(),
    execute: async ({ dataset_id, arguments: args }) => {
      const { data } = await mlClient.post("/ml/run", {
        dataset_id,
        task: "clustering",
        feature_columns: args.feature_columns,
        algorithm: args.algorithm,
      });
      return data;
    },
    extractEvidence: (result) => ({
      best_model: result?.best_model,
      cluster_count: result?.cluster_count,
      silhouette_score: result?.silhouette_score,
    }),
  },

  explainability: {
    name: "explainability",
    description:
      "Explains which features drive a classification/regression model's predictions (global + example-level).",
    deterministic: true,
    chainable: false,
    // Same underlying /ml/run call as classification/regression --
    // explainability is already embedded in that response. This tool
    // is a semantic alias so the planner can ask for it directly.
    argsSchema: z
      .object({
        task: z.enum(["classification", "regression"]),
        target_column: z.string().min(1),
        feature_columns: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    execute: async ({ dataset_id, arguments: args }) => {
      const { data } = await mlClient.post("/ml/run", {
        dataset_id,
        task: args.task,
        target_column: args.target_column,
        feature_columns: args.feature_columns,
      });
      return data;
    },
    extractEvidence: (result) => ({
      global_top_features: result?.explainability?.global?.top_features,
      local_method: result?.explainability?.local?.method,
      local_examples: result?.explainability?.local?.examples,
    }),
  },

  data_source_info: {
    name: "data_source_info",
    description:
      "Where this dataset came from (upload vs. connector) and non-secret source metadata (host/database/table/etc). Never includes credentials.",
    deterministic: true,
    chainable: false,
    argsSchema: z.object({}).strict(),
    // IMPORTANT: this tool does NOT call FastAPI at all. It only reads
    // fields already present on the Mongo Dataset doc fetched by
    // getOwnedDataset() -- sourceType/sourceMetadata are already
    // sanitized at write time by connectorController.js
    // (SAFE_METADATA_FIELDS), so no credential ever reaches this tool.
    execute: async ({ datasetDoc }) => {
      return {
        source_type: datasetDoc?.sourceType || "upload",
        source_metadata: datasetDoc?.sourceMetadata || null,
      };
    },
    extractEvidence: (result) => result,
  },
};

const TOOL_NAMES = Object.freeze(Object.keys(TOOLS));

export function hasTool(name) {
  return Object.prototype.hasOwnProperty.call(TOOLS, name);
}

export function getTool(name) {
  return TOOLS[name];
}

export function listTools() {
  return TOOL_NAMES.map((name) => ({
    name,
    description: TOOLS[name].description,
    chainable: TOOLS[name].chainable,
  }));
}

export function timeoutFor(name) {
  return TOOL_TIMEOUTS[name] ?? 30_000;
}

// Throws on unknown tool or invalid arguments -- callers must fail
// closed, never silently continue with un-validated/partial arguments.
export function validateArgs(name, rawArgs) {
  const tool = getTool(name);

  if (!tool) {
    const err = new Error(`Unknown tool "${name}"`);
    err.code = "UNKNOWN_TOOL";
    throw err;
  }

  const parsed = tool.argsSchema.safeParse(rawArgs ?? {});

  if (!parsed.success) {
    const err = new Error(
      `Invalid arguments for tool "${name}": ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ")}`
    );
    err.code = "INVALID_ARGUMENTS";
    throw err;
  }

  return parsed.data;
}

export async function executeTool(name, context) {
  const tool = getTool(name);

  if (!tool) {
    const err = new Error(`Unknown tool "${name}"`);
    err.code = "UNKNOWN_TOOL";
    throw err;
  }

  return tool.execute(context);
}

export function summarizeResult(name, result) {
  const tool = getTool(name);

  if (!tool || typeof tool.extractEvidence !== "function") {
    return result;
  }

  try {
    return tool.extractEvidence(result);
  } catch {
    // Evidence extraction is a convenience for prompt-size control --
    // never let it break the actual tool result.
    return result;
  }
}

export const ALLOWED_AGENT_TOOLS = TOOL_NAMES;
