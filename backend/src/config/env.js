import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/datainsight_ai",
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:8001",
  internalApiKey: process.env.INTERNAL_API_KEY || "dev_internal_key_change_me",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 50),
};

export const aiEnabled = () => Boolean(config.openaiApiKey);
