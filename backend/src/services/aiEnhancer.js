import OpenAI from "openai";
import { config, aiEnabled } from "../config/env.js";

let client = null;
function getClient() {
  if (!aiEnabled()) return null;
  if (!client) client = new OpenAI({ apiKey: config.openaiApiKey });
  return client;
}

/**
 * Polishes/expands a locally-generated answer using OpenAI, grounded in the
 * text context we already computed (never sends raw row-level data).
 * Returns null if AI is disabled or the call fails — callers should always
 * fall back to the local answer in that case.
 */
export async function enhanceWithOpenAI(prompt, context) {
  const openai = getClient();
  if (!openai) return null;
  try {
    const response = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [
        {
          role: "system",
          content:
            "You are a senior data analyst. Be concise, concrete, and business-oriented. " +
            "Use the provided dataset context; never invent numbers not present in it.",
        },
        { role: "user", content: `Dataset context:\n${context}\n\nRequest: ${prompt}` },
      ],
      max_tokens: 500,
      temperature: 0.4,
    });
    return response.choices[0]?.message?.content || null;
  } catch (err) {
    console.error("[OpenAI] enhancement failed:", err.message);
    return null;
  }
}
