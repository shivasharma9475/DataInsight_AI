import mongoose from "mongoose";

const datasetSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mlDatasetId: { type: String, required: true }, // ID used by the ML microservice
    filename: { type: String, required: true },
    rowCount: { type: Number, default: 0 },
    columnCount: { type: Number, default: 0 },
    isCleaned: { type: Boolean, default: false },

    // Where this dataset came from. "upload" (default) covers the
    // original CSV/Excel flow; connector-imported datasets record which
    // connector and a small set of non-secret descriptors only --
    // credentials are never persisted here or anywhere else.
    sourceType: {
      type: String,
      enum: ["upload", "rest", "mysql", "postgres", "google_sheets"],
      default: "upload",
    },
    sourceMetadata: {
      type: new mongoose.Schema(
        {
          url: String,
          host: String,
          database: String,
          schema: String,
          table: String,
          resource: String,
        },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Dataset", datasetSchema);
