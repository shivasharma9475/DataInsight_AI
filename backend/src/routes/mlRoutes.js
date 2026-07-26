import { Router } from "express";
import * as mlController from "../controllers/mlController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/:datasetId/recommend", mlController.recommend);
router.post("/run", mlController.run);

export default router;
