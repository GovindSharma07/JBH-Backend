import { Response, NextFunction } from 'express';
import { InstructorService } from '../services/instructorService';
import { StudentService } from '../services/studentService';
import LessonService from '../services/lessonService';
import { AppError } from '../utils/errors';
import { AuthenticatedRequest } from '../utils/types';
import { generateVideoSDKToken } from '../utils/videoSdkClient';

class LmsController {

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

    static getLessonDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { lessonId } = req.params;
            if (!lessonId) throw new AppError("Lesson ID is required", 400);

            const lesson = await LessonService.getLessonDetails(Number(lessonId));

            res.json({ success: true, lesson });
        } catch (e) { next(e); }
    };
}

export default LmsController;

export function getStudentTimetable(arg0: string, authenticateUser: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>, getStudentTimetable: any) {
    throw new Error('Function not implemented.');
}


export function joinClass(arg0: string, authenticateUser: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>, joinClass: any) {
    throw new Error('Function not implemented.');
}


export function getLessonDetails(arg0: string, authenticateUser: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>, getLessonDetails: any) {
    throw new Error('Function not implemented.');
}


export function getInstructorSchedule(arg0: string, authenticateUser: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>, arg2: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined, getInstructorSchedule: any) {
    throw new Error('Function not implemented.');
}


export function startClass(arg0: string, authenticateUser: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>, arg2: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined, startClass: any) {
    throw new Error('Function not implemented.');
}
