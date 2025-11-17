import { Router } from "express";
import AuthController from "../controllers/authcontroller";
import AuthMiddleware from "../middlewares/authMiddleware";
const router = Router();

// --- Auth Routes ---
router.post("/auth/register", AuthController.signup);
router.post("/auth/login", AuthController.login);

// --- Verification & Password Reset ---
router.post("/auth/verify-email", AuthController.verifyEmail);
router.post("/auth/verify-phone", AuthController.verifyPhone);
router.post("/auth/forgot-password", AuthController.forgotPassword);
router.post("/auth/reset-password", AuthController.resetPassword);

// --- Protected User Route ---
router.get("/users/me", AuthMiddleware.authenticate, AuthController.getMe);

export default router;