import { Router } from "express";
import * as aiController from "../controllers/aiController.js";
import { requireAuth } from "../middleware/auth.js";
import { expensiveOperationLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/:datasetId/insights",
  expensiveOperationLimiter,
  aiController.insights
);

export default router;