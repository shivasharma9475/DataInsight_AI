import { Router } from "express";
import multer from "multer";
import * as datasetController from "../controllers/datasetController.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config/env.js";
import path from "path";

const allowedExtensions = new Set([
  ".csv",
  ".xlsx",
  ".xls",
]);

const allowedMimeTypes = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: config.maxUploadMb * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const validExtension = allowedExtensions.has(extension);
    const validMimeType = allowedMimeTypes.has(file.mimetype);

    if (!validExtension || !validMimeType) {
      const error = new Error(
        "Invalid file type. Only CSV and Excel files are allowed."
      );

      error.status = 400;

      return cb(error);
    }

    cb(null, true);
  },
});

const router = Router();
router.use(requireAuth);

router.post("/upload", upload.single("file"), datasetController.upload);
router.get("/search", datasetController.search);
router.get("/history", datasetController.history);
router.get("/notifications", datasetController.notifications);
router.delete("/:datasetId",datasetController.deleteDataset);
router.get("/:datasetId/profile", datasetController.profile);
router.get("/:datasetId/cleaning-suggestions", datasetController.cleaningSuggestions);
router.post("/clean", datasetController.clean);
router.get("/:datasetId/eda", datasetController.eda);
router.get("/:datasetId/outliers", datasetController.outliers);
router.get("/:datasetId/charts", datasetController.charts);
router.get("/:datasetId/preview", datasetController.preview);


export default router;
