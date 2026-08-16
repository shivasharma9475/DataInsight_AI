import { config } from "../../config/env.js";
import { getOpenAIClient } from "../copilotPlanner.js";
import { planNextStep } from "./agentPlanner.js";
import {
  hasTool,
  validateArgs,
  executeTool,
  summarizeResult,
  timeoutFor,
} from "./toolRegistry.js";

export const MAX_TOOL_CALLS = 5;

// =========================================================
// Guards
// =========================================================

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${Math.round(ms / 1000)}s`);
      err.code = "TOOL_TIMEOUT";
      reject(err);
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function callSignature(tool, args) {
  return `${tool}:${JSON.stringify(args, Object.keys(args || {}).sort())}`;
}

function isRepeatedCall(state, tool, args) {
  const signature = callSignature(tool, args);
  return state._executedSignatures.has(signature);
}

// =========================================================
// State
// =========================================================

function initState({ dataset_id, message, profile, datasetDoc }) {
  return {
    dataset_id,
    user_question: message,
    profile,
    datasetDoc,
    plan_history: [],
    evidence: [],
    assumptions: [],
    warnings: [],
    tool_call_count: 0,
    ai_used: false,
    final_answer: null,
    pattern_id: null,
    deterministicQueue: null,
    usingDeterministicQueue: false,
    _executedSignatures: new Set(),
  };
}

// =========================================================
// Loop
// =========================================================

export async function runAgent({ dataset_id, message, profile, datasetDoc }) {
  const state = initState({ dataset_id, message, profile, datasetDoc });
  const startedAt = Date.now();
  const deadlineMs = config.agentDeadlineMs;

  while (state.tool_call_count < MAX_TOOL_CALLS) {
    if (Date.now() - startedAt > deadlineMs) {
      state.warnings.push(
        `Stopped after ${state.tool_call_count} step(s): agent time budget of ${Math.round(deadlineMs / 1000)}s exceeded.`
      );
      break;
    }

    let step;
    try {
      step = await planNextStep(state);
    } catch (error) {
      state.warnings.push(`Planning failed: ${safeMessage(error)}`);
      break;
    }

    if (!step || step.action === "final_answer") {
      break;
    }

    if (step.action === "unsupported") {
      // No A-F pattern matched and no OpenAI plan was available --
      // mirrors the existing single-shot UNSUPPORTED_QUERY behavior.
      const err = new Error("I couldn't map that question to a supported analysis yet.");
      err.code = "UNSUPPORTED_QUERY";
      throw err;
    }

    if (step.action !== "tool_call") {
      state.warnings.push(`Planner returned an unrecognized action; stopping.`);
      break;
    }

    // -----------------------------------------------------
    // Fail closed: unknown tool
    // -----------------------------------------------------
    if (!hasTool(step.tool)) {
      state.warnings.push(`Planner requested unknown tool "${step.tool}"; stopping.`);
      break;
    }

    // -----------------------------------------------------
    // Fail closed: invalid arguments (never silently ignored
    // or "fixed up" -- the whole step is rejected)
    // -----------------------------------------------------
    let validatedArgs;
    try {
      validatedArgs = validateArgs(step.tool, step.arguments);
    } catch (error) {
      state.warnings.push(`Rejected step: ${safeMessage(error)}`);
      break;
    }

    // -----------------------------------------------------
    // Repeated identical call guard
    // -----------------------------------------------------
    if (isRepeatedCall(state, step.tool, validatedArgs)) {
      state.warnings.push(`Skipped repeated "${step.tool}" call with identical arguments.`);
      break;
    }

    // -----------------------------------------------------
    // Execute with a per-tool timeout. Preserve prior evidence
    // if this step fails or times out -- do not discard earlier
    // successful steps.
    // -----------------------------------------------------
    let result;
    try {
      result = await withTimeout(
        executeTool(step.tool, { dataset_id, arguments: validatedArgs, datasetDoc: state.datasetDoc }),
        timeoutFor(step.tool),
        step.tool
      );
    } catch (error) {
      state.warnings.push(`"${step.tool}" failed: ${safeMessage(error)}`);
      break;
    }

    state.tool_call_count += 1;
    state._executedSignatures.add(callSignature(step.tool, validatedArgs));
    state.plan_history.push({ step: state.tool_call_count, tool: step.tool, arguments: validatedArgs, planner: step.planner });
    state.evidence.push({
      step: state.tool_call_count,
      tool: step.tool,
      arguments: validatedArgs,
      result_summary: summarizeResult(step.tool, result),
    });
  }

  if (state.tool_call_count >= MAX_TOOL_CALLS) {
    state.warnings.push(`Stopped after reaching the maximum of ${MAX_TOOL_CALLS} tool calls.`);
  }

  state.final_answer = await synthesizeAnswer(state);
  return state;
}

function safeMessage(error) {
  // Never leak internals (stack traces, connection strings, etc.) into
  // warnings that get returned to the client / shown to the LLM.
  return String(error?.message || error || "Unknown error").slice(0, 300);
}

// =========================================================
// Synthesis
// =========================================================

function formatEvidenceStep(entry) {
  const summary = entry.result_summary;

  switch (entry.tool) {
    case "aggregate": {
      const labels = { sum: "Total", mean: "Average", median: "Median", min: "Minimum", max: "Maximum", count: "Count" };
      return `${labels[summary.aggregation] || summary.aggregation} ${summary.metric}: ${formatNumber(summary.value)}`;
    }
    case "group_by": {
      const rows = (summary.top_results || [])
        .slice(0, 5)
        .map((r) => `${r.dimension_value}: ${formatNumber(r.value)}`)
        .join(", ");
      return `${summary.aggregation} ${summary.metric} by ${summary.dimension}: ${rows}`;
    }
    case "trend": {
      const points = (summary.points || []).slice(-5).map((p) => `${p.period}: ${formatNumber(p.value)}`).join(", ");
      return `${summary.metric} trend (${summary.period}): ${points}`;
    }
    case "root_cause": {
      const comparison = summary.comparison || {};
      const contributors = (summary.top_contributors || [])
        .map((c) => `${c.dimension} ${c.value}: ${c.change >= 0 ? "+" : ""}${formatNumber(c.change)}`)
        .join(", ");
      let text = `Metric ${comparison.direction || "changed"}`;
      if (comparison.percentage_change !== undefined && comparison.percentage_change !== null) {
        text += ` by ${Math.abs(Number(comparison.percentage_change)).toFixed(2)}%`;
      }
      if (contributors) text += `. Main contributors: ${contributors}`;
      return text;
    }
    case "recommendation": {
      const recs = (summary.recommendations || []).slice(0, 3).map((r) => r.title || r.text || JSON.stringify(r)).join("; ");
      return `Recommendations: ${recs || "none available"}`;
    }
    case "what_if": {
      if (summary.scenario_type === "segment") {
        return `Scenario: ${summary.baseline_segment} -> ${summary.projected_segment} (${summary.change_percentage}% change)`;
      }
      return `Scenario: ${formatNumber(summary.baseline_total)} -> ${formatNumber(summary.projected_total)} (${summary.change_percentage}% change)`;
    }
    case "forecast": {
      return `Forecast method: ${summary.method}. Trend: ${summary.trend_direction} (${summary.pct_change_projected}% projected).`;
    }
    case "classification":
    case "regression": {
      return `Best model: ${summary.best_model} (score ${summary.best_score}).`;
    }
    case "clustering": {
      return `Best clustering: ${summary.best_model}, ${summary.cluster_count} clusters (silhouette ${summary.silhouette_score}).`;
    }
    case "explainability": {
      const top = (summary.global_top_features || []).slice(0, 3).map((f) => f.feature).join(", ");
      return `Top influential features: ${top || "unavailable"}.`;
    }
    case "data_source_info": {
      return `Data source: ${summary.source_type}.`;
    }
    case "dataset_summary":
    case "dataset_profile": {
      return `Dataset: ${formatNumber(summary.row_count)} rows.`;
    }
    default:
      return JSON.stringify(summary);
  }
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function deterministicSynthesis(state) {
  if (state.evidence.length === 0) {
    // No tool succeeded at all -- nothing evidence-based to report. The
    // raw warning (which may include internal detail, e.g. a network
    // error from a failed OpenAI call) is still available separately in
    // `state.warnings` / the Chat UI's disclosure panel; keep the
    // primary answer generic and free of internal detail either way.
    return "I wasn't able to complete this analysis. See the analysis steps for details.";
  }

  const parts = state.evidence.map((e) => formatEvidenceStep(e));
  const answer = parts.join(" ");

  // NOTE: warnings are deliberately NOT concatenated into the answer
  // text. They're already returned separately in the API response
  // (`warnings`) and rendered distinctly in the Chat UI's "analysis
  // steps" disclosure -- folding raw warning strings (which can include
  // internal operational detail, e.g. network/host errors from a failed
  // OpenAI call) into the primary answer would leak that detail into
  // the main chat bubble and duplicate what's already shown cleanly
  // elsewhere.
  return answer;
}

async function openAiSynthesis(state, deterministicAnswer) {
  const client = getOpenAIClient();
  if (!client) return null;

  try {
    const prompt = `
Rewrite the following verified analysis into a clear, concise answer for
a business user. Use ONLY the facts below -- do not introduce any number,
percentage, or claim that isn't already present. Do not perform any new
calculations.

Question: ${state.user_question}

Verified evidence:
${JSON.stringify(state.evidence, null, 2)}

Draft answer built directly from the evidence:
${deterministicAnswer}
`;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [{ role: "user", content: prompt }],
    });

    const text = response.output_text?.trim();
    return text || null;
  } catch (error) {
    return null;
  }
}

export async function synthesizeAnswer(state) {
  const deterministicAnswer = deterministicSynthesis(state);

  if (process.env.OPENAI_API_KEY && state.evidence.length > 0) {
    const polished = await openAiSynthesis(state, deterministicAnswer);
    if (polished) {
      state.ai_used = true;
      return polished;
    }
  }

  return deterministicAnswer;
}
