import { Router } from 'express';
import { authenticateUser, authorizeRoles } from '../middlewares/authMiddleware';
import * as LMSController from '../controllers/lmsController';

const router = Router();

// --- STUDENT ROUTES ---
router.get(
    '/student/timetable',
    authenticateUser,
    LMSController.getStudentTimetable
);

router.get(
    '/student/get-token',
    authenticateUser,
    LMSController.joinClass
);


// --- INSTRUCTOR ROUTES ---
router.get(
    '/instructor/schedule',
    authenticateUser,
    authorizeRoles('instructor', 'admin'),
    LMSController.getInstructorSchedule
);

router.post(
    '/instructor/start-class',
    authenticateUser,
    authorizeRoles('instructor', 'admin'),
    LMSController.startClass
);

export default router;