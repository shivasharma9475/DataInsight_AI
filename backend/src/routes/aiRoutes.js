import { Router } from "express";

import * as aiController from "../controllers/aiController.js";

import { requireAuth } from "../middleware/auth.js";
import { expensiveOperationLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";

import {
  rootCauseSchema,
  copilotQuerySchema,
  recommendationSchema,
} from "../schemas/aiSchemas.js";

const router = Router();

// All AI routes require authentication
router.use(requireAuth);


// ============================================================
// Root Cause Analysis
// ============================================================

router.post(
  "/root-cause",
  expensiveOperationLimiter,
  validate(rootCauseSchema),
  aiController.rootCause
);


// ============================================================
// Recommendation Engine
// ============================================================

router.post(
  "/recommendations",
  expensiveOperationLimiter,
  validate(recommendationSchema),
  aiController.recommendations
);


// ============================================================
// Data Copilot
// ============================================================

router.post(
  "/copilot",
  expensiveOperationLimiter,
  validate(copilotQuerySchema),
  aiController.copilotQuery
);


// ============================================================
// AI Insights
// IMPORTANT: Keep dynamic :datasetId route after static routes.
// ============================================================

router.get(
  "/:datasetId/insights",
  expensiveOperationLimiter,
  aiController.insights
);


export default router;