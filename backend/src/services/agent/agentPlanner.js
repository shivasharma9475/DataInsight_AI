import {
  getOpenAIClient,
  buildSchema,
  normalize,
  findMentionedColumn,
  detectAggregation,
  detectPeriod,
  extractJson,
  deterministicPlan as legacySingleToolPlan,
} from "../copilotPlanner.js";

import { listTools, hasTool } from "./toolRegistry.js";

// =========================================================
// Horizon parsing for forecast ("next 30 days", "next 6 months")
//
// This is the one piece of NL parsing that has no existing engine
// to delegate to (unlike What-if, which already has its own hybrid
// NL parser in Python that we reuse via the `question` field).
// =========================================================

function detectHorizon(message) {
  const text = normalize(message);
  const match = text.match(/next\s+(\d+)\s*(day|week|month|quarter|year)s?/);

  if (!match) {
    return 30;
  }

  const n = parseInt(match[1], 10);

  if (!Number.isFinite(n) || n < 1) {
    return 30;
  }

  return Math.min(n, 730);
}

// =========================================================
// Deterministic fallback workflows A-F
//
// Each pattern below plans a FIXED sequence of tool calls up
// front. This is intentionally NOT adaptive/general reasoning --
// it recognizes a small set of named request shapes and always
// performs the same steps for them, exactly as approved.
// =========================================================

function planPatternA(message, schema) {
  // "Why did sales decline?" -> trend -> root_cause
  const text = normalize(message);
  const metric = findMentionedColumn(message, schema.numerical_columns);

  if (!metric) return null;
  if (!/\bwhy\b/.test(text) && !/\b(decline|drop|fall|fell|decreas)/.test(text)) return null;

  const dateColumn = schema.datetime_columns[0];
  if (!dateColumn) return null;

  const period = detectPeriod(message);

  return {
    patternId: "A",
    plannedSteps: [
      {
        tool: "trend",
        arguments: { date_column: dateColumn, metric_column: metric, period, aggregation: "sum" },
      },
      {
        tool: "root_cause",
        arguments: {
          date_column: dateColumn,
          metric_column: metric,
          dimension_columns: schema.categorical_columns.slice(0, 3),
          period,
          comparison_mode: "comparable",
        },
      },
    ],
  };
}

function planPatternB(message, schema) {
  // "Which region performs best and why?" -> group_by -> root_cause
  const text = normalize(message);
  const metric = findMentionedColumn(message, schema.numerical_columns);
  const dimension = findMentionedColumn(message, schema.categorical_columns);

  if (!metric || !dimension) return null;
  if (!/\b(best|top|highest|worst|lowest)\b/.test(text)) return null;
  if (!/\b(why|because|reason)\b/.test(text)) return null;

  const steps = [
    {
      tool: "group_by",
      arguments: { metric_column: metric, dimension_column: dimension, aggregation: "sum" },
    },
  ];

  const dateColumn = schema.datetime_columns[0];
  if (dateColumn) {
    steps.push({
      tool: "root_cause",
      arguments: {
        date_column: dateColumn,
        metric_column: metric,
        dimension_columns: [dimension, ...schema.categorical_columns.filter((c) => c !== dimension)].slice(0, 3),
        period: detectPeriod(message),
        comparison_mode: "comparable",
      },
    });
  }

  return { patternId: "B", plannedSteps: steps };
}

function planPatternC(message, schema) {
  // "Analyze this dataset and give important insights"
  // -> dataset_profile -> trend? -> group_by? -> recommendation
  const text = normalize(message);

  if (!/\b(analy[sz]e|insight|overview)\b/.test(text)) return null;

  const steps = [{ tool: "dataset_profile", arguments: {} }];

  const metric = schema.numerical_columns[0];
  const dateColumn = schema.datetime_columns[0];
  const dimension = schema.categorical_columns[0];

  if (metric && dateColumn) {
    steps.push({
      tool: "trend",
      arguments: { date_column: dateColumn, metric_column: metric, period: "M", aggregation: "sum" },
    });
  }

  if (metric && dimension) {
    steps.push({
      tool: "group_by",
      arguments: { metric_column: metric, dimension_column: dimension, aggregation: "sum" },
    });
  }

  if (metric) {
    steps.push({
      tool: "recommendation",
      arguments: {
        metric_column: metric,
        dimension_columns: schema.categorical_columns.slice(0, 3),
        max_recommendations: 20,
      },
    });
  }

  // Cap at 5 total (MAX_STEPS) -- dataset_profile + up to 4 more.
  return { patternId: "C", plannedSteps: steps.slice(0, 5) };
}

function planPatternD(message, schema) {
  // "What if West sales increase by 15%?" -> what_if
  // Delegate NL parsing to the existing hybrid What-if engine itself
  // (its own deterministic_v1 planner) rather than re-parsing here.
  const text = normalize(message);
  if (!/\bwhat if\b/.test(text) && !/\bwhat happens if\b/.test(text)) return null;

  return {
    patternId: "D",
    plannedSteps: [{ tool: "what_if", arguments: { question: message } }],
  };
}

function planPatternE(message, schema) {
  // "Forecast sales for next 30 days" -> forecast
  //
  // Deliberately requires an explicit forecast/projection word, OR
  // "predict" combined with an explicit time-horizon phrase -- plain
  // "predict" alone is ambiguous with ML pattern F ("predict churn").
  const text = normalize(message);
  const hasHorizon = /next\s+\d+\s*(day|week|month|quarter|year)s?/.test(text);
  const mentionsForecast = /\b(forecast|projection)\b/.test(text);
  const mentionsPredictWithHorizon = /\bpredict\b/.test(text) && hasHorizon;

  if (!mentionsForecast && !mentionsPredictWithHorizon) return null;

  const metric = findMentionedColumn(message, schema.numerical_columns);
  if (!metric) return null;

  const dateColumn = schema.datetime_columns[0];
  if (!dateColumn) return null;

  return {
    patternId: "E",
    plannedSteps: [
      {
        tool: "forecast",
        arguments: { date_column: dateColumn, metric_column: metric, periods: detectHorizon(message) },
      },
    ],
  };
}

function planPatternF(message, schema) {
  // "Train a classification/regression/clustering model" -> ML tool
  const text = normalize(message);

  const wantsClassification = /\bclassif/.test(text);
  const wantsRegression = /\bregress|predict\s+\w+\s+value\b/.test(text);
  const wantsClustering = /\bcluster|segment.*into|group.*into\b/.test(text);

  if (!wantsClassification && !wantsRegression && !wantsClustering) return null;

  if (wantsClustering) {
    const features = schema.numerical_columns.slice(0, 10);
    if (features.length < 1) return null;
    return {
      patternId: "F",
      plannedSteps: [{ tool: "clustering", arguments: { feature_columns: features } }],
    };
  }

  const targetPool = wantsClassification ? schema.categorical_columns : schema.numerical_columns;
  const target = findMentionedColumn(message, targetPool) || targetPool[0];
  if (!target) return null;

  const features = [...schema.numerical_columns, ...schema.categorical_columns]
    .filter((c) => c !== target)
    .slice(0, 10);
  if (features.length < 1) return null;

  return {
    patternId: "F",
    plannedSteps: [
      {
        tool: wantsClassification ? "classification" : "regression",
        arguments: { target_column: target, feature_columns: features },
      },
    ],
  };
}

const PATTERNS = [planPatternB, planPatternA, planPatternC, planPatternD, planPatternF, planPatternE];

export function deterministicFallbackPlan(message, profile) {
  const schema = buildSchema(profile);

  for (const pattern of PATTERNS) {
    const plan = pattern(message, schema);
    if (plan && plan.plannedSteps.length > 0) {
      return plan;
    }
  }

  // No A-F pattern matched -- fall back further to the existing
  // single-tool deterministic planner (reused, not duplicated) so
  // simple one-off questions ("total sales?", "sales by region")
  // still work without OpenAI.
  const legacyPlan = legacySingleToolPlan(message, schema);
  if (legacyPlan) {
    return { patternId: "legacy_single_tool", plannedSteps: [{ tool: legacyPlan.tool, arguments: legacyPlan.arguments }] };
  }

  return null;
}

// =========================================================
// OpenAI multi-step planning
//
// Given the running agent state (question + schema + evidence
// gathered so far), ask OpenAI to either propose the next tool
// call or declare it has enough evidence to answer.
// =========================================================

function buildToolCatalogText() {
  return listTools()
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");
}

async function planNextStepWithOpenAI({ message, schema, evidence }) {
  const client = getOpenAIClient();
  if (!client) return null;

  const systemPrompt = `
You are the planning layer of DataInsight AI's agentic Data Copilot.

You investigate a user's data question step by step by choosing ONE
tool at a time from the catalog below. You NEVER calculate numbers
yourself -- every number must come from a tool result.

TOOL CATALOG:
${buildToolCatalogText()}

DATASET SCHEMA:
${JSON.stringify(schema)}

Respond with JSON ONLY, no prose, no markdown fences, in exactly one
of these two shapes:

To call a tool:
{"action": "tool_call", "tool": "<tool name>", "arguments": { ... }}

When you have enough evidence to answer (or no more tools would help):
{"action": "final_answer"}

Rules:
- Only use tool names from the catalog above.
- Only use column names that appear in the dataset schema above.
- Look at the evidence already gathered before deciding the next step.
- Do not repeat an identical tool call with identical arguments.
- Prefer the fewest steps that give a well-supported answer.
`;

  const userPrompt = `
User question: ${message}

Evidence gathered so far (tool -> result summary), in order:
${JSON.stringify(evidence, null, 2)}
`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const parsed = extractJson(response.output_text);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OpenAI agent planner returned a malformed plan");
  }

  if (parsed.action === "final_answer") {
    return { action: "final_answer" };
  }

  if (parsed.action === "tool_call") {
    if (!hasTool(parsed.tool)) {
      throw new Error(`OpenAI proposed an unknown tool "${parsed.tool}"`);
    }
    return {
      action: "tool_call",
      tool: parsed.tool,
      arguments: parsed.arguments && typeof parsed.arguments === "object" ? parsed.arguments : {},
    };
  }

  throw new Error(`OpenAI agent planner returned an unrecognized action "${parsed.action}"`);
}

// =========================================================
// Public: plan the next step of the agent loop
// =========================================================

export async function planNextStep(state) {
  const schema = buildSchema(state.profile);

  // Step >=2 while running a deterministic fixed sequence: just pop
  // the next planned step, no re-planning needed.
  if (state.deterministicQueue && state.deterministicQueue.length > 0) {
    const next = state.deterministicQueue.shift();
    return { action: "tool_call", tool: next.tool, arguments: next.arguments, planner: "deterministic" };
  }
  if (state.deterministicQueue && state.deterministicQueue.length === 0 && state.usingDeterministicQueue) {
    return { action: "final_answer", planner: "deterministic" };
  }

  // Step 1 (or continuing OpenAI-driven planning): try OpenAI first.
  if (process.env.OPENAI_API_KEY) {
    try {
      const step = await planNextStepWithOpenAI({
        message: state.user_question,
        schema,
        evidence: state.evidence,
      });

      if (step) {
        state.ai_used = true;
        return { ...step, planner: "openai" };
      }
    } catch (error) {
      state.warnings.push(`OpenAI planning failed at step ${state.tool_call_count + 1}, falling back: ${error.message}`);
    }
  }

  // Deterministic fallback. Only computed once, at the first step --
  // if we're past step 1 and OpenAI just failed mid-loop, try to
  // continue via the A-F pattern that matches the FIRST executed
  // tool, if any; otherwise stop.
  if (state.tool_call_count === 0) {
    const plan = deterministicFallbackPlan(state.user_question, state.profile);

    if (!plan) {
      return { action: "unsupported", planner: "deterministic" };
    }

    state.pattern_id = plan.patternId;
    state.usingDeterministicQueue = true;
    state.deterministicQueue = plan.plannedSteps.slice(1);

    const first = plan.plannedSteps[0];
    return { action: "tool_call", tool: first.tool, arguments: first.arguments, planner: "deterministic" };
  }

  // OpenAI failed after at least one step already executed via
  // OpenAI planning (not a deterministic queue) -- stop safely
  // rather than guessing.
  return { action: "final_answer", planner: "deterministic" };
}
