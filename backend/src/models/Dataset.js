import mongoose from "mongoose";

const datasetSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mlDatasetId: { type: String, required: true }, // ID used by the ML microservice
    filename: { type: String, required: true },
    rowCount: { type: Number, default: 0 },
    columnCount: { type: Number, default: 0 },
    isCleaned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Dataset", datasetSchema);
