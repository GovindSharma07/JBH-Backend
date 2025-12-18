import { Router } from "express";
import AdminController from "../controllers/adminController";
import AuthMiddleware from "../middlewares/authMiddleware";
import { JobController } from "../controllers/jobController";

const router = Router();

// Protect all routes with Authentication
router.use(AuthMiddleware.authenticate);

// Middleware to ensure Admin Role for all subsequent routes
router.use((req, res, next) => {
    const user = (req as any).user;
    if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access Denied: Admins Only" });
    }
    next();
});

router.get("/admin/users", AdminController.getAllUsers);
router.post("/admin/users", AdminController.createUser);
router.delete("/admin/users/:id", AdminController.deleteUser);
router.patch("/admin/users/:id/block", AdminController.blockUser);
router.post("/admin/upload-url", AdminController.getUploadUrl);

router.post("/admin/timetable", AdminController.createScheduleSlot);
router.delete("/admin/timetable/:id", AdminController.deleteScheduleSlot);

router.post('/jobs/cleanup', JobController.runCleanup);
export default router;