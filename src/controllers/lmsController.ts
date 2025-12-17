import { Request, Response, NextFunction } from 'express'; // Remove 'Request' from here if not used elsewhere
import { InstructorService } from '../services/instructorService';
import { StudentService } from '../services/studentService';
import { generateVideoSDKToken } from '../utils/videoSdkClient';
import { AppError } from '../utils/errors';
// 1. IMPORT THE INTERFACE
import { AuthenticatedRequest } from '../utils/types';

// --- INSTRUCTOR ---

// 2. USE 'AuthenticatedRequest' HERE
export const getInstructorSchedule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // 3. SAFE CASTING: We treat user as the object type we defined
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

export const joinClass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Simple endpoint to get a token for a student
    const token = generateVideoSDKToken('participant');
    res.json({ success: true, token });
  } catch (e) { next(e); }
};