import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";

import { generalLimiter } from "./middleware/rateLimiter.js";
import { config, aiEnabled } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import datasetRoutes from "./routes/datasetRoutes.js";
import mlRoutes from "./routes/mlRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.use("/api", generalLimiter);

app.get("/", (req, res) => {
  res.json({
    service: "DataInsight AI API (Node/Express)",
    status: "running",
    ai_mode: aiEnabled() ? "openai" : "local",
    docs: "See README.md for API routes",
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/ml", mlRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/reports", reportRoutes);

app.use(errorHandler);

export default app;