// src/routes/apprenticeshipRoutes.ts

import { Router } from "express";
import ApprenticeshipController from "../controllers/apprenticeshipController";
import AuthMiddleware from "../middlewares/authMiddleware";

const router = Router();

// Student: View all (Protected to check 'applied' status)
router.get("/apprenticeships", AuthMiddleware.authenticate, ApprenticeshipController.getAll);

// Public/Student: View details
router.get("/apprenticeships/:id", ApprenticeshipController.getOne);

// Student: Apply
router.post("/apprenticeships/apply", AuthMiddleware.authenticate, ApprenticeshipController.apply);

// Admin: Create & View All Data
router.post("/apprenticeships", AuthMiddleware.authenticate, ApprenticeshipController.create);
router.get("/admin/applications", AuthMiddleware.authenticate, ApprenticeshipController.getAdminApplications);

export default router;