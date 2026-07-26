import FormData from "form-data";
import mlClient from "../services/mlClient.js";
import Dataset from "../models/Dataset.js";

async function getOwnedDataset(datasetMongoIdOrMlId, userId) {
  // Frontend addresses datasets by the ML service's dataset_id (UUID), which
  // we also store on the Mongo doc — look up by that field, scoped to owner.
  const doc = await Dataset.findOne({ mlDatasetId: datasetMongoIdOrMlId, owner: userId });
  if (!doc) {
    const err = new Error("Dataset not found");
    err.status = 404;
    throw err;
  }
  return doc;
}

export async function upload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ detail: "No file uploaded" });

    const form = new FormData();
    form.append("file", req.file.buffer, { filename: req.file.originalname });

    const { data } = await mlClient.post("/ingest", form, { headers: form.getHeaders() });

    const doc = await Dataset.create({
      owner: req.userId,
      mlDatasetId: data.dataset_id,
      filename: req.file.originalname,
      rowCount: data.profile.row_count,
      columnCount: data.profile.column_count,
    });

    res.json({ dataset_id: doc.mlDatasetId, filename: doc.filename, profile: data.profile });
  } catch (err) {
    next(err);
  }
}

export async function history(req, res, next) {
  try {
    const docs = await Dataset.find({ owner: req.userId }).sort({ createdAt: -1 });
    res.json(
      docs.map((d) => ({
        dataset_id: d.mlDatasetId,
        filename: d.filename,
        row_count: d.rowCount,
        column_count: d.columnCount,
        uploaded_at: d.createdAt,
        is_cleaned: d.isCleaned,
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function profile(req, res, next) {
  try {
    await getOwnedDataset(req.params.datasetId, req.userId);
    const { data } = await mlClient.get(`/datasets/${req.params.datasetId}/profile`);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function cleaningSuggestions(req, res, next) {
  try {
    await getOwnedDataset(req.params.datasetId, req.userId);
    const { data } = await mlClient.get(`/datasets/${req.params.datasetId}/cleaning-suggestions`);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function clean(req, res, next) {
  try {
    const doc = await getOwnedDataset(req.body.dataset_id, req.userId);
    const { data } = await mlClient.post("/datasets/clean", req.body);
    doc.isCleaned = true;
    doc.rowCount = data.profile.row_count;
    await doc.save();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function eda(req, res, next) {
  try {
    await getOwnedDataset(req.params.datasetId, req.userId);
    const { data } = await mlClient.get(`/datasets/${req.params.datasetId}/eda`);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function outliers(req, res, next) {
  try {
    await getOwnedDataset(req.params.datasetId, req.userId);
    const { data } = await mlClient.get(`/datasets/${req.params.datasetId}/outliers`);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function charts(req, res, next) {
  try {
    await getOwnedDataset(req.params.datasetId, req.userId);
    const { data } = await mlClient.get(`/datasets/${req.params.datasetId}/charts`);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function preview(req, res, next) {
  try {
    await getOwnedDataset(req.params.datasetId, req.userId);
    const limit = req.query.limit || 50;
    const { data } = await mlClient.get(`/datasets/${req.params.datasetId}/preview?limit=${limit}`);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export { getOwnedDataset };
