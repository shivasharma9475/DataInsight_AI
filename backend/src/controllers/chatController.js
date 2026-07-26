import mlClient from "../services/mlClient.js";
import { getOwnedDataset } from "./datasetController.js";
import { enhanceWithOpenAI } from "../services/aiEnhancer.js";
import { aiEnabled } from "../config/env.js";
import ChatMessage from "../models/ChatMessage.js";

export async function ask(req, res, next) {
  try {
    const doc = await getOwnedDataset(req.body.dataset_id, req.userId);
    const { data } = await mlClient.post("/chat/ask", req.body);

    let answer = data.answer;
    let enhanced = false;

    if (aiEnabled()) {
      const context = `${doc.rowCount} rows in "${doc.filename}". Local analysis found: ${data.answer}`;
      const polished = await enhanceWithOpenAI(req.body.message, context);
      if (polished) {
        answer = polished;
        enhanced = true;
      }
    }

    await ChatMessage.create({ dataset: doc._id, user: req.userId, message: req.body.message, answer });

    res.json({ answer, data: data.data, ai_enhanced: enhanced });
  } catch (err) {
    next(err);
  }
}

export async function history(req, res, next) {
  try {
    const doc = await getOwnedDataset(req.params.datasetId, req.userId);
    const messages = await ChatMessage.find({ dataset: doc._id, user: req.userId }).sort({ createdAt: 1 });
    res.json(messages.map((m) => ({ message: m.message, answer: m.answer, timestamp: m.createdAt })));
  } catch (err) {
    next(err);
  }
}
