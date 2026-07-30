import mlClient from "../services/mlClient.js";
import { getOwnedDataset } from "./datasetController.js";
import { planCopilotQuestion } from "../services/copilotPlanner.js";
import ChatMessage from "../models/ChatMessage.js";


// =========================================================
// Helpers
// =========================================================

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return number.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}


// =========================================================
// Deterministic answer formatter
//
// IMPORTANT:
//
// OpenAI is used in copilotPlanner.js ONLY to understand
// the user's question and generate a safe analytics plan.
//
// Actual calculations happen in the ML service.
//
// This formatter converts the verified ML result into
// readable text without making another OpenAI request.
// =========================================================

function formatCopilotAnswer(plan, result) {
  if (!result) {
    return "The analysis completed, but no result was returned.";
  }

  switch (plan.tool) {

    // =====================================================
    // Aggregate
    // =====================================================

    case "aggregate": {
      const metric =
        result.metric ||
        plan.arguments.metric_column;

      const aggregation =
        result.aggregation ||
        plan.arguments.aggregation;

      const value = result.value;

      if (
        value === null ||
        value === undefined
      ) {
        return `No valid ${metric} value was available for this calculation.`;
      }

      const labels = {
        sum: "Total",
        mean: "Average",
        min: "Minimum",
        max: "Maximum",
        count: "Count",
      };

      return `${
        labels[aggregation] ||
        aggregation
      } ${metric}: ${formatNumber(value)}`;
    }


    // =====================================================
    // Dataset Summary
    // =====================================================

    case "dataset_summary": {
      const rows =
        result.rows ??
        result.row_count ??
        result.total_rows ??
        result.valid_rows;

      const columns =
        result.columns ??
        result.column_count ??
        result.total_columns;

      const parts = [];

      if (
        rows !== undefined &&
        rows !== null
      ) {
        parts.push(
          `${formatNumber(rows)} rows`
        );
      }

      if (Array.isArray(columns)) {
        parts.push(
          `${columns.length} columns`
        );
      } else if (
        columns !== undefined &&
        columns !== null
      ) {
        parts.push(
          `${formatNumber(columns)} columns`
        );
      }

      if (parts.length > 0) {
        return `Dataset summary: ${parts.join(", ")}.`;
      }

      return `Dataset summary: ${JSON.stringify(result)}`;
    }


    // =====================================================
    // Group By
    // =====================================================

    case "group_by": {
      const metric =
        result.metric ||
        plan.arguments.metric_column;

      const dimension =
        result.dimension ||
        result.dimension_column ||
        plan.arguments.dimension_column;

      const aggregation =
        result.aggregation ||
        plan.arguments.aggregation;

      const rows =
        result.data ||
        result.results ||
        result.groups ||
        result.values;

      if (
        Array.isArray(rows) &&
        rows.length > 0
      ) {
        const preview = rows
          .slice(0, 10)
          .map((item) => {
            const label =
              item[dimension] ??
              item.dimension_value ??
              item.group ??
              item.name ??
              item.label ??
              "Unknown";

            const value =
              item.result ??
              item.metric_value ??
              item[metric] ??
              item.total ??
              item.aggregated_value ??
              item.value;

            return `${label}: ${formatNumber(value)}`;
          })
          .join(", ");

        return `${
          aggregation || "sum"
        } ${metric} by ${dimension}: ${preview}`;
      }

      return `${
        aggregation || "sum"
      } ${metric} by ${dimension}: ${JSON.stringify(result)}`;
    }


    // =====================================================
    // Trend
    // =====================================================

    case "trend": {
      const metric =
        result.metric ||
        plan.arguments.metric_column;

      const period =
        result.period ||
        plan.arguments.period;

      const periodLabels = {
        D: "Daily",
        W: "Weekly",
        M: "Monthly",
        Q: "Quarterly",
        Y: "Yearly",
      };

      const points =
        result.data ||
        result.results ||
        result.points ||
        result.trend ||
        result.values;

      if (
        Array.isArray(points) &&
        points.length > 0
      ) {
        const preview = points
          .slice(-10)
          .map((item) => {
            const label =
              item.period ??
              item.date ??
              item.label ??
              item.time;

            const value =
              item.value ??
              item.result ??
              item.metric_value ??
              item[metric] ??
              item.total;

            return `${label}: ${formatNumber(value)}`;
          })
          .join(", ");

        return `${
          periodLabels[period] ||
          period ||
          "Time"
        } ${metric} trend: ${preview}`;
      }

      return `${
        periodLabels[period] ||
        period ||
        "Time"
      } ${metric} trend: ${JSON.stringify(result)}`;
    }


    // =====================================================
    // Root Cause Analysis
    // =====================================================

    case "root_cause": {
      const metric =
        result.metric ||
        plan.arguments.metric_column;

      const comparison =
        result.comparison || {};

      const direction =
        comparison.direction ||
        "changed";

      const percentage =
        comparison.percentage_change;

      const absoluteChange =
        comparison.absolute_change;

      const previousPeriod =
        comparison.previous_period;

      const currentPeriod =
        comparison.current_period;

      const contributors =
        result.top_contributors || [];

      let answer = "";

      // Period comparison
      if (
        previousPeriod &&
        currentPeriod
      ) {
        answer += `${metric} from ${previousPeriod} to ${currentPeriod} `;
      } else {
        answer += `${metric} `;
      }

      // Direction
      if (direction === "increase") {
        answer += "increased";
      } else if (direction === "decrease") {
        answer += "decreased";
      } else if (direction === "no_change") {
        answer += "did not change";
      } else {
        answer += "changed";
      }

      // Percentage
      if (
        percentage !== null &&
        percentage !== undefined
      ) {
        answer += ` by ${Math.abs(
          Number(percentage)
        ).toFixed(2)}%`;
      }

      // Absolute change
      if (
        absoluteChange !== null &&
        absoluteChange !== undefined
      ) {
        answer += ` (${formatNumber(
          absoluteChange
        )})`;
      }

      answer += ".";

      // Top contributors
      if (contributors.length > 0) {
        const topContributors =
          contributors.slice(0, 3);

        const contributorText =
          topContributors
            .map((item) => {
              const dimension =
                item.dimension ||
                "segment";

              const value =
                item.value ||
                "Unknown";

              const change =
                item.change;

              return `${dimension} ${value}: ${
                Number(change) >= 0
                  ? "+"
                  : ""
              }${formatNumber(change)}`;
            })
            .join(", ");

        answer += ` Main contributors: ${contributorText}.`;
      }

      // Comparable-window warning
      const warning =
        result.analysis_quality?.warning;

      if (warning) {
        answer += ` ${warning}`;
      }

      return answer;
    }


    // =====================================================
    // Unknown tool
    // =====================================================

    default:
      return JSON.stringify(result);
  }
}


// =========================================================
// ASK DATA COPILOT
// =========================================================

export async function ask(
  req,
  res,
  next
) {
  try {

    const {
      dataset_id,
      message,
    } = req.body;


    // =====================================================
    // 1. Validate request
    // =====================================================

    if (!dataset_id) {
      return res.status(400).json({
        code: "MISSING_DATASET_ID",
        message: "dataset_id is required",
      });
    }


    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        code: "MISSING_MESSAGE",
        message: "message is required",
      });
    }


    // =====================================================
    // 2. Security / ownership
    // =====================================================

    const doc =
      await getOwnedDataset(
        dataset_id,
        req.userId
      );


    // =====================================================
    // 3. Get real dataset profile/schema
    //
    // Planner must use actual columns from the dataset.
    // =====================================================

    const { data: profile } =
      await mlClient.get(
        `/datasets/${dataset_id}/profile`
      );


    // =====================================================
    // 4. Natural language -> analytics plan
    //
    // PRIMARY:
    // OpenAI planner
    //
    // FALLBACK:
    // deterministic planner
    //
    // This logic lives inside copilotPlanner.js.
    // =====================================================

    let plan;

    try {

      plan =
        await planCopilotQuestion({
          message: message.trim(),
          profile,
        });

    } catch (error) {

      // ---------------------------------------------------
      // Expected unsupported query
      //
      // This is NOT a server error.
      // ---------------------------------------------------

      if (
        error.code ===
        "UNSUPPORTED_QUERY"
      ) {

        return res.status(422).json({
          code: "UNSUPPORTED_QUERY",

          message:
            "I couldn't understand that analysis request. Try asking about totals, averages, category breakdowns, trends, or why a metric changed.",
        });

      }

      throw error;
    }


    // =====================================================
    // 5. Execute verified calculation
    //
    // OpenAI does NOT calculate dataset values.
    //
    // Python ML service performs the calculation.
    // =====================================================

    const { data: execution } =
      await mlClient.post(
        "/copilot/query",
        {
          dataset_id,

          tool:
            plan.tool,

          arguments:
            plan.arguments,
        }
      );


    // Support both:
    //
    // {
    //   tool: "...",
    //   result: {...}
    // }
    //
    // and direct result responses.

    const result =
      execution?.result ??
      execution;


    // =====================================================
    // 6. Format verified result LOCALLY
    //
    // IMPORTANT:
    //
    // NO second OpenAI call here.
    //
    // Therefore:
    //
    // User question
    //      ↓
    // OpenAI planner      = 1 call
    //      ↓
    // ML service
    //      ↓
    // Local formatter
    //
    // Maximum one OpenAI request per Copilot question.
    // =====================================================

    const answer =
      formatCopilotAnswer(
        plan,
        result
      );


    // =====================================================
    // 7. Save chat history
    // =====================================================

    await ChatMessage.create({
      dataset:
        doc._id,

      user:
        req.userId,

      message:
        message.trim(),

      answer,
    });


    // =====================================================
    // 8. Return answer + evidence
    // =====================================================

    return res.json({
      answer,

      data:
        result,

      // Answer itself was not generated by OpenAI.
      ai_enhanced:
        false,

      copilot: {
        planner:
          plan.planner ||
          "unknown",

        tool:
          plan.tool,

        arguments:
          plan.arguments,
      },
    });

  } catch (err) {

    console.error(
      "[COPILOT ASK ERROR]",
      err
    );

    next(err);
  }
}


// =========================================================
// CHAT HISTORY
// =========================================================

export async function history(
  req,
  res,
  next
) {
  try {

    // =====================================================
    // 1. Verify ownership
    // =====================================================

    const doc =
      await getOwnedDataset(
        req.params.datasetId,
        req.userId
      );


    // =====================================================
    // 2. Load messages
    // =====================================================

    const messages =
      await ChatMessage.find({
        dataset:
          doc._id,

        user:
          req.userId,
      }).sort({
        createdAt: 1,
      });


    // =====================================================
    // 3. Response
    // =====================================================

    return res.json(
      messages.map((m) => ({
        message:
          m.message,

        answer:
          m.answer,

        timestamp:
          m.createdAt,
      }))
    );

  } catch (err) {

    next(err);
  }
}