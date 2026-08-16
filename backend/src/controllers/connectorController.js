import mlClient from "../services/mlClient.js";
import Dataset from "../models/Dataset.js";

// Fields from a connector `config` object that are safe to persist as
// dataset provenance metadata. Everything else (password, api key,
// token, header values, etc.) is dropped -- never written to Mongo,
// never logged, never returned to the client beyond this request.
const SAFE_METADATA_FIELDS = ["url", "host", "database", "schema"];

// axios errors carry the original request (err.config.data / err.request),
// which for these two endpoints includes the connector credentials. The
// global error handler logs the full error server-side -- redact the
// request body before it ever gets there, so a failed connection attempt
// never writes a password/token to the server logs.
function redactAxiosError(err) {
  if (err?.config) {
    err.config.data = "[redacted: may contain connector credentials]";
  }
  if (err?.request) {
    err.request = "[redacted]";
  }
  return err;
}

function buildSourceMetadata(type, config, resource) {
  const metadata = {};

  for (const field of SAFE_METADATA_FIELDS) {
    if (typeof config?.[field] === "string" && config[field]) {
      metadata[field] = config[field];
    }
  }

  if (resource) {
    if (type === "mysql" || type === "postgres") {
      metadata.table = resource;
    } else {
      metadata.resource = resource;
    }
  }

  return metadata;
}

function deriveFilename(type, config, resource) {
  switch (type) {
    case "mysql":
    case "postgres":
      return `${config?.database || type}.${resource}`;
    case "rest":
      return `rest_${resource || "import"}`;
    case "google_sheets":
      return `google_sheet_${resource || "import"}`;
    default:
      return `${type}_import`;
  }
}

export async function testConnector(req, res, next) {
  try {
    const { type, config } = req.body;

    const { data } = await mlClient.post("/connectors/test", {
      type,
      config,
    });

    return res.json(data);
  } catch (err) {
    next(redactAxiosError(err));
  }
}

export async function importConnector(req, res, next) {
  try {
    const { type, config, resource, limit } = req.body;

    const { data } = await mlClient.post("/connectors/import", {
      type,
      config,
      resource,
      limit,
    });

    const filename = deriveFilename(type, config, resource);

    const doc = await Dataset.create({
      owner: req.userId,
      mlDatasetId: data.result.dataset_id,
      filename,
      rowCount: data.result.profile.row_count,
      columnCount: data.result.profile.column_count,
      sourceType: type,
      sourceMetadata: buildSourceMetadata(type, config, resource),
    });

    return res.json({
      dataset_id: doc.mlDatasetId,
      filename: doc.filename,
      source_type: doc.sourceType,
      profile: data.result.profile,
    });
  } catch (err) {
    next(redactAxiosError(err));
  }
}
