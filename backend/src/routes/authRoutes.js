import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  signupSchema,
  loginSchema,
} from "../schemas/authSchemas.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post(
  "/signup",
  authLimiter,
  validate(signupSchema),
  authController.signup
);

router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  authController.login
);

router.post("/google", authController.googleLogin);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/me", requireAuth, authController.me);

export default router;
