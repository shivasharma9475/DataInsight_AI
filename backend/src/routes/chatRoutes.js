import { Router } from "express";
import * as chatController from "../controllers/chatController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/ask", chatController.ask);
router.get("/:datasetId/history", chatController.history);

export default router;
