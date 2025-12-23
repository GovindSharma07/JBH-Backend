import { Router } from 'express';
import AuthMiddleware, { authenticateUser, authorizeRoles } from '../middlewares/authMiddleware';
import LmsController from '../controllers/lmsController';
import { validate } from '../middlewares/validate';
import { joinClassSchema,startClassSchema } from '../utils/validators';

const router = Router();

// --- STUDENT ROUTES ---
router.get(
    '/student/timetable',
    authenticateUser,
    LmsController.getStudentTimetable
);

router.post(
    '/student/join-class',
    authenticateUser,
    validate(joinClassSchema),
    LmsController.joinClass
);

router.get(
    '/student/lesson/:lessonId',
    authenticateUser,
    LmsController.getLessonDetails // Make sure to export this in lmsController
);

router.get(
    '/student/attendance',
    authenticateUser,
    LmsController.getAttendance
);

router.get(
    '/student/timetable/weekly', // New Endpoint
    authenticateUser,
    LmsController.getWeeklyTimetable
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
    validate(startClassSchema),
    LmsController.startLiveClass
);

router.post(
    '/instructor/end-class',
    authenticateUser,
    authorizeRoles('instructor', 'admin'),
    LmsController.endLiveClass
);

router.get("/instructor/dashboard", authenticateUser,LmsController.getInstructorDashboard);


router.post(
    '/recording/start', 
    authenticateUser, 
    authorizeRoles('instructor', 'admin'), 
    LmsController.triggerRecording
);




export default router;