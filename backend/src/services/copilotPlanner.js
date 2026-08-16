import OpenAI from "openai";


// =========================================================
// OpenAI client
//
// IMPORTANT: created lazily, only when an API key is present
// and a call is actually about to be made. Instantiating this
// eagerly at module load throws when OPENAI_API_KEY is unset,
// which would crash the whole backend on startup -- OpenAI
// must remain fully optional.
// =========================================================

let _openaiClient = null;

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  if (!_openaiClient) {
    _openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return _openaiClient;
}


// =========================================================
// Allowed analytics operations
// =========================================================

const ALLOWED_TOOLS = new Set([
  "dataset_summary",
  "aggregate",
  "group_by",
  "trend",
  "root_cause",
]);

const ALLOWED_AGGREGATIONS = new Set([
  "sum",
  "mean",
  "min",
  "max",
  "count",
]);

const ALLOWED_PERIODS = new Set([
  "D",
  "W",
  "M",
  "Q",
  "Y",
]);


// =========================================================
// Helpers
// =========================================================

export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function getColumnName(column) {
  if (typeof column === "string") {
    return column;
  }

  return column?.name;
}


export function buildSchema(profile = {}) {
  return {
    columns: (profile.columns || [])
      .map(getColumnName)
      .filter(Boolean),

    numerical_columns:
      profile.numerical_columns || [],

    categorical_columns:
      profile.categorical_columns || [],

    datetime_columns:
      profile.datetime_columns || [],
  };
}


export function extractJson(text) {
  if (!text) {
    throw new Error(
      "OpenAI planner returned an empty response"
    );
  }

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(
      "OpenAI planner returned invalid JSON"
    );
  }
}


// =========================================================
// Plan validation
// =========================================================

export function validatePlan(plan, schema) {
  if (
    !plan ||
    typeof plan !== "object" ||
    Array.isArray(plan)
  ) {
    throw new Error(
      "Invalid Copilot plan"
    );
  }


  // -------------------------------------------------------
  // Tool
  // -------------------------------------------------------

  if (!ALLOWED_TOOLS.has(plan.tool)) {
    throw new Error(
      `Unsupported Copilot tool: ${plan.tool}`
    );
  }


  const args =
    plan.arguments &&
    typeof plan.arguments === "object" &&
    !Array.isArray(plan.arguments)
      ? plan.arguments
      : {};


  const numericalColumns =
    new Set(
      schema.numerical_columns
    );

  const categoricalColumns =
    new Set(
      schema.categorical_columns
    );

  const datetimeColumns =
    new Set(
      schema.datetime_columns
    );


  // -------------------------------------------------------
  // Dataset summary
  // -------------------------------------------------------

  if (
    plan.tool === "dataset_summary"
  ) {
    return {
      tool: "dataset_summary",
      arguments: {},
    };
  }


  // -------------------------------------------------------
  // Metric validation
  // -------------------------------------------------------

  if (
    plan.tool === "aggregate" ||
    plan.tool === "group_by" ||
    plan.tool === "trend" ||
    plan.tool === "root_cause"
  ) {
    if (
      !args.metric_column ||
      !numericalColumns.has(
        args.metric_column
      )
    ) {
      throw new Error(
        `Invalid metric column: ${
          args.metric_column ??
          "missing"
        }`
      );
    }
  }


  // -------------------------------------------------------
  // Aggregation validation
  // -------------------------------------------------------

  if (
    plan.tool === "aggregate" ||
    plan.tool === "group_by" ||
    plan.tool === "trend"
  ) {
    if (
      !ALLOWED_AGGREGATIONS.has(
        args.aggregation
      )
    ) {
      throw new Error(
        `Invalid aggregation: ${
          args.aggregation ??
          "missing"
        }`
      );
    }
  }


  // -------------------------------------------------------
  // Group by validation
  // -------------------------------------------------------

  if (
    plan.tool === "group_by"
  ) {
    if (
      !args.dimension_column ||
      !categoricalColumns.has(
        args.dimension_column
      )
    ) {
      throw new Error(
        `Invalid dimension column: ${
          args.dimension_column ??
          "missing"
        }`
      );
    }
  }


  // -------------------------------------------------------
  // Trend + RCA date/period validation
  // -------------------------------------------------------

  if (
    plan.tool === "trend" ||
    plan.tool === "root_cause"
  ) {
    if (
      !args.date_column ||
      !datetimeColumns.has(
        args.date_column
      )
    ) {
      throw new Error(
        `Invalid date column: ${
          args.date_column ??
          "missing"
        }`
      );
    }

    if (
      !ALLOWED_PERIODS.has(
        args.period
      )
    ) {
      throw new Error(
        `Invalid period: ${
          args.period ??
          "missing"
        }`
      );
    }
  }


  // -------------------------------------------------------
  // RCA validation
  // -------------------------------------------------------

  if (
    plan.tool === "root_cause"
  ) {
    if (
      !Array.isArray(
        args.dimension_columns
      )
    ) {
      throw new Error(
        "dimension_columns must be an array"
      );
    }

    if (
      args.dimension_columns.length > 3
    ) {
      throw new Error(
        "Maximum 3 dimensions are allowed for Copilot RCA"
      );
    }

    for (
      const dimension
      of args.dimension_columns
    ) {
      if (
        !categoricalColumns.has(
          dimension
        )
      ) {
        throw new Error(
          `Invalid dimension column: ${dimension}`
        );
      }
    }

    if (
      ![
        "full",
        "comparable",
      ].includes(
        args.comparison_mode
      )
    ) {
      throw new Error(
        "Invalid comparison_mode"
      );
    }
  }


  return {
    tool: plan.tool,
    arguments: args,
  };
}


// =========================================================
// Deterministic fallback helpers
// =========================================================

export function findMentionedColumn(
  message,
  columns = []
) {
  const normalizedMessage =
    normalize(message);

  const sorted =
    [...columns].sort(
      (a, b) =>
        String(b).length -
        String(a).length
    );

  for (const column of sorted) {
    const normalizedColumn =
      normalize(column);

    if (
      normalizedColumn &&
      normalizedMessage.includes(
        normalizedColumn
      )
    ) {
      return column;
    }
  }

  return null;
}


export function detectAggregation(message) {
  const text = normalize(message);

  if (
    /\b(average|avg|mean)\b/.test(
      text
    )
  ) {
    return "mean";
  }

  if (
    /\b(minimum|min|lowest)\b/.test(
      text
    )
  ) {
    return "min";
  }

  if (
    /\b(maximum|max|highest)\b/.test(
      text
    )
  ) {
    return "max";
  }

  if (
    /\b(count|number of|how many)\b/.test(
      text
    )
  ) {
    return "count";
  }

  return "sum";
}


export function detectPeriod(message) {
  const text = normalize(message);

  if (
    /\b(daily|day by day|per day)\b/.test(
      text
    )
  ) {
    return "D";
  }

  if (
    /\b(weekly|week by week|per week)\b/.test(
      text
    )
  ) {
    return "W";
  }

  if (
    /\b(quarterly|quarter|per quarter)\b/.test(
      text
    )
  ) {
    return "Q";
  }

  if (
    /\b(yearly|annual|annually|per year)\b/.test(
      text
    )
  ) {
    return "Y";
  }

  return "M";
}


// =========================================================
// Deterministic fallback planner
// =========================================================

export function deterministicPlan(
  message,
  schema
) {
  const text = normalize(message);


  const metric =
    findMentionedColumn(
      message,
      schema.numerical_columns
    );


  const dimension =
    findMentionedColumn(
      message,
      schema.categorical_columns
    );


  const dateColumn =
    findMentionedColumn(
      message,
      schema.datetime_columns
    );


  // -------------------------------------------------------
  // Dataset summary
  // -------------------------------------------------------

  if (
    /\b(summary|summarize|overview|describe dataset|dataset info)\b/.test(
      text
    )
  ) {
    return {
      tool: "dataset_summary",
      arguments: {},
    };
  }


  // -------------------------------------------------------
  // Root cause
  // -------------------------------------------------------

  if (
    metric &&
    (
      /\bwhy\b/.test(text) ||
      /\b(root cause|reason|cause|driver|contributor|contribution)\b/.test(
        text
      )
    )
  ) {
    const selectedDate =
      dateColumn ||
      schema.datetime_columns[0];

    if (!selectedDate) {
      return null;
    }

    return {
      tool: "root_cause",

      arguments: {
        date_column:
          selectedDate,

        metric_column:
          metric,

        dimension_columns:
          schema.categorical_columns.slice(
            0,
            3
          ),

        period:
          detectPeriod(message),

        comparison_mode:
          "comparable",
      },
    };
  }


  // -------------------------------------------------------
  // Trend
  // -------------------------------------------------------

  if (
    metric &&
    (
      /\b(trend|over time|time series)\b/.test(
        text
      ) ||
      /\b(daily|weekly|monthly|quarterly|yearly|annual)\b/.test(
        text
      )
    )
  ) {
    const selectedDate =
      dateColumn ||
      schema.datetime_columns[0];

    if (!selectedDate) {
      return null;
    }

    return {
      tool: "trend",

      arguments: {
        date_column:
          selectedDate,

        metric_column:
          metric,

        period:
          detectPeriod(message),

        aggregation:
          detectAggregation(message),
      },
    };
  }


  // -------------------------------------------------------
  // Group by
  // -------------------------------------------------------

  if (
    metric &&
    dimension &&
    /\b(by|per|each|top|highest|lowest|best|worst|breakdown)\b/.test(
      text
    )
  ) {
    return {
      tool: "group_by",

      arguments: {
        metric_column:
          metric,

        dimension_column:
          dimension,

        aggregation:
          detectAggregation(message),
      },
    };
  }


  // -------------------------------------------------------
  // Aggregate
  // -------------------------------------------------------

  if (
    metric &&
    /\b(total|sum|average|avg|mean|minimum|min|maximum|max|count|number of|how many)\b/.test(
      text
    )
  ) {
    return {
      tool: "aggregate",

      arguments: {
        metric_column:
          metric,

        aggregation:
          detectAggregation(message),
      },
    };
  }


  return null;
}


// =========================================================
// OpenAI planner
// =========================================================

async function planWithOpenAI({
  message,
  schema,
}) {

  const systemPrompt = `
You are the planning layer of DataInsight AI.

Your job is to understand a user's natural-language
data analytics question and translate it into exactly
ONE analytics tool call.

You DO NOT calculate the answer.

The Python analytics service performs all calculations
using the real dataset.

============================================================
AVAILABLE TOOLS
============================================================

1. dataset_summary

arguments:

{}


2. aggregate

arguments:

{
  "metric_column": string,
  "aggregation": "sum" | "mean" | "min" | "max" | "count"
}


3. group_by

arguments:

{
  "metric_column": string,
  "dimension_column": string,
  "aggregation": "sum" | "mean" | "min" | "max" | "count"
}


4. trend

arguments:

{
  "date_column": string,
  "metric_column": string,
  "period": "D" | "W" | "M" | "Q" | "Y",
  "aggregation": "sum" | "mean" | "min" | "max" | "count"
}


5. root_cause

arguments:

{
  "date_column": string,
  "metric_column": string,
  "dimension_columns": string[],
  "period": "D" | "W" | "M" | "Q" | "Y",
  "comparison_mode": "full" | "comparable"
}


============================================================
RULES
============================================================

Use ONLY columns present in the supplied dataset schema.

Never invent column names.

Never calculate dataset values yourself.

Return exactly ONE analytics tool call.

For questions asking for an overview or description of
the dataset, use dataset_summary.

For total/sum/average/minimum/maximum/count questions,
use aggregate.

For questions asking for a metric broken down by a
category, use group_by.

Examples:

"sales by region"
"revenue per product"
"average profit by category"

For questions asking how a metric changes over time,
use trend.

Examples:

"monthly sales trend"
"how has revenue changed over time?"
"weekly average sales"

Period mapping:

daily       -> D
weekly      -> W
monthly     -> M
quarterly   -> Q
yearly      -> Y

If the user asks about a trend without specifying a
period, use M.

For questions asking WHY a metric changed, use
root_cause.

Examples:

"why did sales decline?"
"what caused revenue to increase?"
"which segments contributed to the sales drop?"

For root_cause:

- use comparable comparison by default
- use at most 3 relevant categorical dimensions
- use M when the user does not specify a period

The metric_column must be a numerical column.

The dimension_column and dimension_columns must be
categorical columns.

The date_column must be a datetime column.

Do not answer the user's question.

Return JSON ONLY.

Required structure:

{
  "tool": "tool_name",
  "arguments": {}
}
`;


  const userPrompt = `
Dataset schema:

All columns:
${JSON.stringify(
  schema.columns,
  null,
  2
)}

Numerical columns:
${JSON.stringify(
  schema.numerical_columns,
  null,
  2
)}

Categorical columns:
${JSON.stringify(
  schema.categorical_columns,
  null,
  2
)}

Datetime columns:
${JSON.stringify(
  schema.datetime_columns,
  null,
  2
)}


User question:

${message}
`;


  const openai = getOpenAIClient();

  if (!openai) {
    throw new Error(
      "OPENAI_API_KEY is not configured."
    );
  }

  const response =
    await openai.responses.create({
      model:
        process.env.OPENAI_MODEL ||
        "gpt-5-mini",

      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });


  return extractJson(
    response.output_text
  );
}


// =========================================================
// Public planner
// =========================================================

export async function planCopilotQuestion({
  message,
  profile,
}) {
  if (!message?.trim()) {
    throw new Error(
      "message is required"
    );
  }


  const schema =
    buildSchema(profile);


  // =======================================================
  // PRIMARY: OpenAI
  // =======================================================

  if (process.env.OPENAI_API_KEY) {
    try {

      const openAIPlan =
        await planWithOpenAI({
          message,
          schema,
        });


      const validated =
        validatePlan(
          openAIPlan,
          schema
        );


      return {
        ...validated,

        planner:
          "openai",
      };

    } catch (error) {

      console.warn(
        "[COPILOT] OpenAI planner failed. Falling back to deterministic planner:",
        error?.message
      );

    }
  }


  // =======================================================
  // FALLBACK: deterministic
  // =======================================================

  const fallbackPlan =
    deterministicPlan(
      message,
      schema
    );


  if (fallbackPlan) {

    const validated =
      validatePlan(
        fallbackPlan,
        schema
      );


    return {
      ...validated,

      planner:
        "deterministic",
    };
  }


  // =======================================================
  // Unsupported
  // =======================================================

  const error = new Error(
    "I couldn't map that question to a supported analysis yet."
  );

  error.code =
    "UNSUPPORTED_QUERY";

  throw error;
}