import { Response, NextFunction } from 'express';
import { InstructorService } from '../services/instructorService';
import { StudentService } from '../services/studentService';
import LessonService from '../services/lessonService';
import { AppError } from '../utils/errors';
import { AuthenticatedRequest } from '../utils/types';
import { generateVideoSDKToken } from '../utils/videoSdkClient';

// --- INSTRUCTOR ---

export const getInstructorSchedule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as { userId: number };
        if (!user || !user.userId) throw new AppError("Unauthorized", 401);

        const schedule = await InstructorService.getMySchedule(user.userId);
        res.json({ success: true, schedule });
    } catch (e) { next(e); }
};

export const startClass = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as { userId: number };
        const { scheduleId, topic } = req.body;

        if (!user || !user.userId) throw new AppError("Unauthorized", 401);
        if (!scheduleId) throw new AppError("Schedule ID is required", 400);

        const { roomId, liveLectureId } = await InstructorService.startLiveClass(
            user.userId,
            Number(scheduleId),
            topic || "Live Class"
        );

        const token = generateVideoSDKToken('moderator');

        res.json({
            success: true,
            message: "Class started",
            roomId,
            token,
            liveLectureId
        });
    } catch (e) { next(e); }
};

// --- STUDENT ---

export const getStudentTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as { userId: number };
        if (!user || !user.userId) throw new AppError("Unauthorized", 401);

        const schedule = await StudentService.getTodayTimetable(user.userId);
        res.json({ success: true, schedule });
    } catch (e) { next(e); }
};

// IMPROVED: Now handles Attendance and Validation
export const joinClass = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user as { userId: number };
        const { liveLectureId } = req.body; // Expecting liveLectureId now

        if (!user || !user.userId) throw new AppError("Unauthorized", 401);
        if (!liveLectureId) throw new AppError("Live Lecture ID is required", 400);

        // Call Service
        const data = await StudentService.joinLiveLecture(user.userId, Number(liveLectureId));

        res.json({ success: true, ...data });
    } catch (e) { next(e); }
};

// REFACTORED: Uses LessonService
export const getLessonDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { lessonId } = req.params;
        if (!lessonId) throw new AppError("Lesson ID is required", 400);

        const lesson = await LessonService.getLessonDetails(Number(lessonId));

        res.json({ success: true, lesson });
    } catch (e) { next(e); }
};