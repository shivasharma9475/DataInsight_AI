import { Router } from "express";

import * as aiController from "../controllers/aiController.js";

import { requireAuth } from "../middleware/auth.js";
import { expensiveOperationLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";

import {
  rootCauseSchema,
  copilotQuerySchema,
} from "../schemas/aiSchemas.js";

const router = Router();

// All AI routes require authentication
router.use(requireAuth);

// Root Cause Analysis
router.post(
  "/root-cause",
  expensiveOperationLimiter,
  validate(rootCauseSchema),
  aiController.rootCause
);

// AI Insights
router.get(
  "/:datasetId/insights",
  expensiveOperationLimiter,
  aiController.insights
);

// Data Copilot
router.post(
  "/copilot",
  expensiveOperationLimiter,
  validate(copilotQuerySchema),
  aiController.copilotQuery
);

export default router;