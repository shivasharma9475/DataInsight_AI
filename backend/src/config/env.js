import dotenv from "dotenv";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

// -----------------------------------------------------------------------
// Secrets: JWT_SECRET and INTERNAL_API_KEY absolutely must not fall back
// to a well-known default in production — that default is public (it's
// right here in this file, and in .env.example), so an attacker who knows
// it can forge JWTs or call the internal ML service directly.
//
// In development/test, we still fall back to a convenient, obviously-fake
// default so the project runs out of the box without extra setup.
// -----------------------------------------------------------------------

function requiredSecret(envVar, devDefault) {
  const value = process.env[envVar];

  if (value) return value;

  if (isProduction) {
    throw new Error(
      `[FATAL] ${envVar} must be set when NODE_ENV=production. ` +
        "Refusing to start with an insecure default secret."
    );
  }

  return devDefault;
}

export const config = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/datainsight_ai",
  jwtSecret: requiredSecret("JWT_SECRET", "dev_secret_change_me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:8001",
  internalApiKey: requiredSecret("INTERNAL_API_KEY", "dev_internal_key_change_me"),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 50),
  // Overall wall-clock budget for one Agentic Copilot request (all tool
  // calls combined). Configurable, not hard-coded aggressively, so it's
  // large enough for legitimate multi-step ML/forecasting chains.
  agentDeadlineMs: Number(process.env.AGENT_DEADLINE_MS || 180_000),
};

export const aiEnabled = () => Boolean(config.openaiApiKey);
