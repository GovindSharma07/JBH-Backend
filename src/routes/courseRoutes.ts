import { Router } from "express";
import CourseController from "../controllers/courseController";
import LessonController from "../controllers/lessonController"; // <-- Import
import AuthMiddleware from "../middlewares/authMiddleware";

const router = Router();

// --- Public / General ---
router.get("/courses", CourseController.getList);
router.get("/courses/:id", CourseController.getDetail);

// --- Student Actions ---
router.post("/courses/:id/enroll", AuthMiddleware.authenticate, CourseController.enroll);
router.get("/my-courses", AuthMiddleware.authenticate, CourseController.getMyCourses);

// --- Lesson Access ---
router.get("/lessons/:id", AuthMiddleware.authenticate, LessonController.getOne);

// --- Admin Only (Content Creation) ---
router.post("/courses", AuthMiddleware.authenticate, CourseController.create);
router.post("/courses/:id/modules", AuthMiddleware.authenticate, CourseController.addModule);
router.post("/lessons", AuthMiddleware.authenticate, LessonController.create); // <-- Add Lesson

export default router;