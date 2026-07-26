import { Router } from "express";
import * as aiController from "../controllers/aiController.js";
import { requireAuth } from "../middleware/auth.js";
import { expensiveOperationLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import { rootCauseSchema } from "../schemas/aiSchemas.js";

const router = Router();

router.use(requireAuth);

router.post(
  "/root-cause",
  expensiveOperationLimiter,
  validate(rootCauseSchema),
  aiController.rootCause
);

router.get(
  "/:datasetId/insights",
  expensiveOperationLimiter,
  aiController.insights
);

export default router;