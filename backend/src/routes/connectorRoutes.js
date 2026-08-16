import { Router } from "express";
import * as connectorController from "../controllers/connectorController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { expensiveOperationLimiter } from "../middleware/rateLimiter.js";
import {
  connectorTestSchema,
  connectorImportSchema,
} from "../schemas/connectorSchemas.js";

const router = Router();

router.use(requireAuth);

router.post(
  "/test",
  expensiveOperationLimiter,
  validate(connectorTestSchema),
  connectorController.testConnector
);

router.post(
  "/import",
  expensiveOperationLimiter,
  validate(connectorImportSchema),
  connectorController.importConnector
);

export default router;
