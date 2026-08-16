import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    dataset: { type: mongoose.Schema.Types.ObjectId, ref: "Dataset", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    answer: { type: String, required: true },

    // Additive, optional -- populated by the Agentic Copilot. Older
    // messages (or any future non-agent path) simply won't have these
    // fields, and history rendering falls back to message/answer only.
    steps: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    evidence: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    warnings: { type: [String], default: undefined },
  },
  { timestamps: true }
);

export default mongoose.model("ChatMessage", chatMessageSchema);
