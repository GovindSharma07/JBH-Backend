// src/routes/courseRoutes.ts
import { Router } from "express";
import CourseController from "../controllers/courseController";
import LessonController from "../controllers/lessonController"; 
import AuthMiddleware from "../middlewares/authMiddleware";

const router = Router();

// --- Public / General ---
router.get("/courses",AuthMiddleware.authenticate, CourseController.getList);
router.get("/courses/:id", CourseController.getDetail);

// --- Student Actions ---
router.post("/courses/:id/enroll", AuthMiddleware.authenticate, CourseController.enroll);
router.get("/my-courses", AuthMiddleware.authenticate, CourseController.getMyCourses);

// --- Lesson Access ---
router.get("/lessons/:id", AuthMiddleware.authenticate, LessonController.getOne);

// --- Admin Only (Content Management) ---
// 1. Courses
router.post("/courses", AuthMiddleware.authenticate, CourseController.create);
router.put("/courses/:id", AuthMiddleware.authenticate, CourseController.update);   // <--- NEW
router.delete("/courses/:id", AuthMiddleware.authenticate, CourseController.delete); // <--- NEW
router.patch("/courses/:id/publish", AuthMiddleware.authenticate, CourseController.togglePublish);

// 2. Modules
router.post("/courses/:id/modules", AuthMiddleware.authenticate, CourseController.addModule);
router.put("/modules/:id", AuthMiddleware.authenticate, CourseController.updateModule);    // <--- NEW
router.delete("/modules/:id", AuthMiddleware.authenticate, CourseController.deleteModule); // <--- NEW
router.put("/courses/:id/modules/reorder", AuthMiddleware.authenticate, CourseController.reorderModules); // <--- NEW

// 3. Lessons
router.post("/lessons", AuthMiddleware.authenticate, LessonController.create);
router.put("/lessons/:id", AuthMiddleware.authenticate, LessonController.update);    // <--- NEW
router.delete("/lessons/:id", AuthMiddleware.authenticate, LessonController.delete); // <--- NEW
router.put("/modules/:id/lessons/reorder", AuthMiddleware.authenticate, LessonController.reorder); // <--- NEW

export default router;