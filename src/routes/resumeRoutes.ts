import { Router } from "express";
import ResumeController from "../controllers/resumeController";
import AuthMiddleware from "../middlewares/authMiddleware";

const router = Router();

// Atomic Upload Flow
router.post("/resumes/upload-url", AuthMiddleware.authenticate, ResumeController.getUploadUrl);
router.post("/resumes", AuthMiddleware.authenticate, ResumeController.uploadResume);

// Management
router.get("/resumes", AuthMiddleware.authenticate, ResumeController.getMyResumes);
router.delete("/resumes/:id", AuthMiddleware.authenticate, ResumeController.deleteResume);

export default router;