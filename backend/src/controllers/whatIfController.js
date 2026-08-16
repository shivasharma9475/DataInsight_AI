import mlClient from "../services/mlClient.js";
import { getOwnedDataset } from "./datasetController.js";

export async function whatIf(req, res, next) {
  try {
    const {
      dataset_id,
      question,
      metric_column,
      dimension_column,
      segment_value,
      change_percentage,
    } = req.body;

    if (!dataset_id) {
      return res.status(400).json({
        message: "dataset_id is required",
      });
    }

    const hasQuestion =
      typeof question === "string" && question.trim().length > 0;

    let payload;

    if (hasQuestion) {
      // -------------------------------------------------------
      // Natural-language mode
      // -------------------------------------------------------
      payload = {
        dataset_id,
        question: question.trim(),
      };
    } else {
      // -------------------------------------------------------
      // Manual mode (unchanged validation, preserved as-is)
      // -------------------------------------------------------
      if (!metric_column) {
        return res.status(400).json({
          message:
            "Either 'question' or 'metric_column' is required.",
        });
      }

      if (
        change_percentage === undefined ||
        change_percentage === null
      ) {
        return res.status(400).json({
          message: "change_percentage is required",
        });
      }

      if (typeof change_percentage !== "number") {
        return res.status(400).json({
          message: "change_percentage must be a number",
        });
      }

      payload = {
        dataset_id,
        metric_column,
        dimension_column: dimension_column || null,
        segment_value: segment_value ?? null,
        change_percentage,
      };
    }

    // Verify that the dataset belongs to
    // the authenticated user.
    await getOwnedDataset(
      dataset_id,
      req.userId
    );

    const { data } = await mlClient.post(
      "/what-if",
      payload
    );

    return res.json(data);
  } catch (err) {
    next(err);
  }
}