import { Router } from "express";
import multer from "multer";
import * as datasetController from "../controllers/datasetController.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config/env.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
});

const router = Router();
router.use(requireAuth);

router.post("/upload", upload.single("file"), datasetController.upload);
router.get("/history", datasetController.history);
router.get("/:datasetId/profile", datasetController.profile);
router.get("/:datasetId/cleaning-suggestions", datasetController.cleaningSuggestions);
router.post("/clean", datasetController.clean);
router.get("/:datasetId/eda", datasetController.eda);
router.get("/:datasetId/outliers", datasetController.outliers);
router.get("/:datasetId/charts", datasetController.charts);
router.get("/:datasetId/preview", datasetController.preview);

export default router;
