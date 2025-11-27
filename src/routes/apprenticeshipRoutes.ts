import { Router } from "express";
import ApprenticeshipController from "../controllers/apprenticeshipController";
import AuthMiddleware from "../middlewares/authMiddleware";

const router = Router();

// Public or Protected (depending on requirements)
router.get("/apprenticeships", ApprenticeshipController.getAll);
router.get("/apprenticeships/:id", ApprenticeshipController.getOne);

// Protected Routes (Require Token)
router.post("/apprenticeships", AuthMiddleware.authenticate, ApprenticeshipController.create); // In real app, check for role='admin' too
router.post("/apprenticeships/apply", AuthMiddleware.authenticate, ApprenticeshipController.apply);

export default router;