import { Response, NextFunction } from 'express';
import InstructorService from '../services/instructorService';
import { StudentService } from '../services/studentService';
import LessonService from '../services/lessonService';
import { AppError } from '../utils/errors';
import { AuthenticatedRequest } from '../utils/types';
import { generateVideoSDKToken } from '../utils/videoSdkClient';

class LmsController {
    static endLiveClass = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            // 1. Safe User Extraction
            const user = req.user;
            if (!user || !user.userId) throw new AppError("Unauthorized", 401);
            const { liveLectureId } = req.body;

            // 2. Validation
            if (!liveLectureId) throw new AppError("Live Lecture ID is required", 400);
            // 3. Call Service to End Class
            await InstructorService.endLiveClass(user.userId, Number(liveLectureId));
            // 4. Response
            res.json({
                success: true,
                message: "Class ended successfully"
            });
        } catch (e) { next(e); }
    };
    

    // --- INSTRUCTOR ---

    static getInstructorSchedule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            // TS Fix: Check existence before access
            if (!req.user || !req.user.userId) throw new AppError("Unauthorized", 401);

            const schedule = await InstructorService.getMySchedule(req.user.userId);
            res.json({ success: true, schedule });
        } catch (e) { next(e); }
    };

    /**
     * Start a Live Class
     * - Fixes 3-Layer Architecture: Calls Service instead of Prisma directly
     * - Fixes TS Error: correctly checks req.user
     */
    static startLiveClass = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            // 1. Safe User Extraction
            const user = req.user;
            if (!user || !user.userId) throw new AppError("Unauthorized", 401);

            const { scheduleId, topic } = req.body;

            // 2. Validation
            if (!scheduleId) throw new AppError("Schedule ID is required", 400);

            // 3. Call Service (Business Logic & DB Interaction)
            // The logic to check for existing classes, create lessons, and update DB is in the service
            const { roomId, liveLectureId, message } = await InstructorService.startLiveClass(
                user.userId,
                Number(scheduleId),
                topic || "Live Class"
            );

            // 4. Generate Token (Controller or Auth Service responsibility)
            // We generate it here so the client gets it immediately
            const token = generateVideoSDKToken('moderator');

            // 5. Response
            res.json({
                success: true,
                message: message || "Class started successfully",
                roomId,
                token,
                liveLectureId
            });
        } catch (e) { next(e); }
    };


    static getStudentTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user || !req.user.userId) throw new AppError("Unauthorized", 401);

            const schedule = await StudentService.getTodayTimetable(req.user.userId);
            res.json({ success: true, schedule });
        } catch (e) { next(e); }
    };

    static joinClass = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user || !req.user.userId) throw new AppError("Unauthorized", 401);

            const { liveLectureId } = req.body;
            if (!liveLectureId) throw new AppError("Live Lecture ID is required", 400);

            // Logic delegated to Service
            const data = await StudentService.joinLiveLecture(req.user.userId, Number(liveLectureId));

            res.json({ success: true, ...data });
        } catch (e) { next(e); }
    };

    // [FIX] Updated to pass userId for enrollment verification
    static getLessonDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { lessonId } = req.params;
            if (!lessonId) throw new AppError("Lesson ID is required", 400);

            if (!req.user || !req.user.userId) throw new AppError("Unauthorized", 401);

            // Pass user ID to service
            const lesson = await LessonService.getLessonDetails(Number(lessonId), req.user.userId);

            res.json({ success: true, lesson });
        } catch (e) { next(e); }
    };

    static getInstructorDashboard = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const user = req.user;
            if (user?.role !== 'instructor') return res.status(403).json({ message: "Instructors only" });

            const data = await InstructorService.getDashboardData(user.userId);
            return res.status(200).json(data);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Failed to load dashboard" });
        }
    }

    static getAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user || !req.user.userId) throw new AppError("Unauthorized", 401);

            const attendance = await StudentService.getAttendance(req.user.userId);
            res.json({ success: true, attendance });
        } catch (e) { next(e); }
    };

    static getWeeklyTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user || !req.user.userId) throw new AppError("Unauthorized", 401);

            const schedule = await StudentService.getWeeklyTimetable(req.user.userId);
            res.json({ success: true, schedule });
        } catch (e) { next(e); }
    };
}

export default LmsController;
