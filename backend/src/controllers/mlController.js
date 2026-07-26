import mlClient from "../services/mlClient.js";
import { getOwnedDataset } from "./datasetController.js";

export async function recommend(req, res, next) {
  try {
    await getOwnedDataset(req.params.datasetId, req.userId);
    const { data } = await mlClient.get(`/ml/${req.params.datasetId}/recommend`);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function run(req, res, next) {
  try {
    await getOwnedDataset(req.body.dataset_id, req.userId);
    const { data } = await mlClient.post("/ml/run", req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
