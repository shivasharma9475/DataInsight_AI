import { Router } from "express";
import * as aiController from "../controllers/aiController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/:datasetId/insights", aiController.insights);

export default router;
