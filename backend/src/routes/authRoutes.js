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
  "/send-signup-otp",
  authLimiter,
  validate(signupSchema),
  authController.sendSignupOtp
);

router.post(
  "/verify-signup-otp",
  authLimiter,
  authController.verifySignupOtp
);

router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  authController.login
);

router.post(
  "/forgot-password",
  authLimiter,
  authController.forgotPassword
);

router.post(
  "/reset-password",
  authLimiter,
  authController.resetPassword
);

router.get(
  "/me",
  requireAuth,
  authController.me
);

export default router;