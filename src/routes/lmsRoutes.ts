import { Router } from 'express';
import { authenticateUser, authorizeRoles } from '../middlewares/authMiddleware';
import LmsController from '../controllers/lmsController';

const router = Router();

// --- STUDENT ROUTES ---
router.get(
    '/student/timetable',
    authenticateUser,
    LmsController.getStudentTimetable
);

router.get(
    '/student/get-token',
    authenticateUser,
    LmsController.joinClass
);

router.get(
    '/student/lesson/:lessonId',
    authenticateUser,
    LmsController.getLessonDetails // Make sure to export this in lmsController
);

// --- INSTRUCTOR ROUTES ---
router.get(
    '/instructor/schedule',
    authenticateUser,
    authorizeRoles('instructor', 'admin'),
    LmsController.getInstructorSchedule
);

router.post(
    '/instructor/start-class',
    authenticateUser,
    authorizeRoles('instructor', 'admin'),
    LmsController.startLiveClass
);

export default router;