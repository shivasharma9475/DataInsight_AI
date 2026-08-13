import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { expensiveOperationLimiter } from "../middleware/rateLimiter.js";
import { whatIf } from "../controllers/whatIfController.js";

const router = Router();

router.use(requireAuth);

router.post(
  "/",
  expensiveOperationLimiter,
  whatIf
);

export default router;