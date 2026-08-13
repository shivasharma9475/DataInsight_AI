import mlClient from "../services/mlClient.js";
import { getOwnedDataset } from "./datasetController.js";

export async function whatIf(req, res, next) {
  try {
    const {
      dataset_id,
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

    if (!metric_column) {
      return res.status(400).json({
        message: "metric_column is required",
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

    // Verify that the dataset belongs to
    // the authenticated user.
    await getOwnedDataset(
      dataset_id,
      req.userId
    );

    const { data } = await mlClient.post(
      "/what-if",
      {
        dataset_id,
        metric_column,
        dimension_column:
          dimension_column || null,
        segment_value:
          segment_value ?? null,
        change_percentage,
      }
    );

    return res.json(data);
  } catch (err) {
    next(err);
  }
}