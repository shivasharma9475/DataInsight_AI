import FormData from "form-data";
import mlClient from "../services/mlClient.js";
import Dataset from "../models/Dataset.js";
import path from "path";

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
    if (!req.file) {
      return res.status(400).json({
        detail: "No file uploaded",
      });
    }

    // Remove any path information from the uploaded filename
    const baseName = path.basename(req.file.originalname);

    // Keep only safe characters
    const safeFilename = baseName.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    const form = new FormData();

    form.append("file", req.file.buffer, {
      filename: safeFilename,
      contentType: req.file.mimetype,
    });

    const { data } = await mlClient.post(
      "/ingest",
      form,
      {
        headers: form.getHeaders(),
      }
    );

    const doc = await Dataset.create({
      owner: req.userId,
      mlDatasetId: data.dataset_id,
      filename: safeFilename,
      rowCount: data.profile.row_count,
      columnCount: data.profile.column_count,
    });

    return res.json({
      dataset_id: doc.mlDatasetId,
      filename: doc.filename,
      profile: data.profile,
    });
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

export async function search(req, res, next) {
  try {
    const q = String(req.query.q || "").trim();

    if (q.length < 2) {
      return res.json({ results: [] });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const docs = await Dataset.find({
      owner: req.userId,
      $or: [
        { filename: regex },
        { "sourceMetadata.table": regex },
        { "sourceMetadata.resource": regex },
        { "sourceMetadata.database": regex },
        { "sourceMetadata.schema": regex },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    res.json({
      results: docs.map((doc) => ({
        id: doc.mlDatasetId,
        type: "dataset",
        title: doc.filename,
        description: `${doc.rowCount ?? 0} rows · ${doc.columnCount ?? 0} columns`,
        datasetId: doc.mlDatasetId,
        route: `/dashboard/${doc.mlDatasetId}`,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function notifications(req, res, next) {
  try {
    const docs = await Dataset.find({ owner: req.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      notifications: docs.map((d) => ({
        id: String(d._id),
        type: d.isCleaned ? "dataset_cleaned" : "dataset_uploaded",
        title: d.isCleaned
          ? "Dataset cleaning completed"
          : "Dataset uploaded",
        message: d.isCleaned
          ? `${d.filename} has been cleaned successfully.`
          : `${d.filename} is ready for analysis.`,
        datasetId: d.mlDatasetId,
        route: `/dashboard/${d.mlDatasetId}`,
        createdAt: d.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}


export { getOwnedDataset };
