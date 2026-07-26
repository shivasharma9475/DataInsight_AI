import { Router } from "express";
import * as reportController from "../controllers/reportController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/:datasetId/excel", reportController.excelReport);
router.get("/:datasetId/pdf", reportController.pdfReport);

export default router;
