import mlClient from "../services/mlClient.js";
import { getOwnedDataset } from "./datasetController.js";
import { runAgent } from "../services/agent/agentOrchestrator.js";
import ChatMessage from "../models/ChatMessage.js";


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
    // 2. Security / ownership -- checked BEFORE any agent
    // execution, exactly as before.
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
    // 4. Run the Agentic Copilot
    //
    // Controlled multi-step loop: plan -> execute (strict
    // schema-validated, allowlisted tools only) -> observe ->
    // decide whether another tool is needed -> synthesize.
    //
    // OpenAI is used only for planning/synthesis, never for
    // calculation -- every number in the final answer traces
    // back to a deterministic tool result in `state.evidence`.
    //
    // `doc` (the Mongo Dataset doc, already ownership-checked)
    // is passed through so the data_source_info tool can read
    // its already-sanitized sourceType/sourceMetadata without
    // any additional network call or credential exposure.
    // =====================================================

    let state;

    try {

      state = await runAgent({
        dataset_id,
        message: message.trim(),
        profile,
        datasetDoc: doc,
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
            "I couldn't understand that analysis request. Try asking about totals, averages, category breakdowns, trends, why a metric changed, what-if scenarios, forecasts, or model training.",
        });

      }

      throw error;
    }


    // =====================================================
    // 5. Save chat history (additive fields only)
    // =====================================================

    await ChatMessage.create({
      dataset:
        doc._id,

      user:
        req.userId,

      message:
        message.trim(),

      answer:
        state.final_answer,

      steps:
        state.plan_history,

      evidence:
        state.evidence,

      warnings:
        state.warnings,
    });


    // =====================================================
    // 6. Return answer + evidence
    //
    // Response shape is ADDITIVE over the previous single-tool
    // response: `answer`, `data`, `ai_enhanced`, and
    // `copilot:{planner, tool, arguments}` all still exist
    // (now describing the LAST executed step, so any existing
    // consumer reading a single tool/arguments pair still gets
    // a sensible value). `steps`, `evidence`, `assumptions`,
    // and `warnings` are new.
    // =====================================================

    const lastStep =
      state.plan_history[state.plan_history.length - 1];

    const lastEvidence =
      state.evidence[state.evidence.length - 1];

    return res.json({
      answer:
        state.final_answer,

      data:
        lastEvidence?.result_summary ?? null,

      ai_enhanced:
        state.ai_used,

      copilot: {
        planner:
          lastStep?.planner || "unknown",

        tool:
          lastStep?.tool || null,

        arguments:
          lastStep?.arguments || null,
      },

      steps:
        state.plan_history,

      evidence:
        state.evidence,

      assumptions:
        state.assumptions,

      warnings:
        state.warnings,
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

        steps:
          m.steps || [],

        evidence:
          m.evidence || [],

        warnings:
          m.warnings || [],
      }))
    );

  } catch (err) {

    next(err);
  }
}