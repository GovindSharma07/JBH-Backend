import prisma from '../utils/prisma';
import { AppError } from '../utils/errors';
import { getISTDate } from '../utils/time';
import { generateVideoSDKToken } from '../utils/videoSdkClient';


export class StudentService {

    // Get Consolidated Timetable (Math + Physics + etc.)
    static async getTodayTimetable(userId: number) {
        const today = getISTDate();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayName = days[today.getDay()] as string;

        // Create Date Range for TODAY (00:00 to 23:59)
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        // 1. Find courses user is enrolled in
        const enrollments = await prisma.enrollments.findMany({
            where: { user_id: userId },
            select: { course_id: true }
        });

        const courseIds = enrollments.map(e => e.course_id);

        if (courseIds.length === 0) return [];

        // 2. Get Schedule (Recurring OR One-Time)
        const schedule = await prisma.time_table.findMany({
            where: {
                course_id: { in: courseIds },
                OR: [
                    // Case A: Recurring Class (Matches Day Name)
                    {
                        schedule_type: 'recurring',
                        day_of_week: { equals: todayName, mode: 'insensitive' }
                    },
                    // Case B: One-Time Class (Matches Date)
                    {
                        schedule_type: 'one-time',
                        specific_date: {
                            gte: startOfDay,
                            lte: endOfDay
                        }
                    }
                ]
            },
            include: {
                course: { select: { title: true, thumbnail_url: true } },
                module: { select: { title: true } }, 
                instructor: { select: { full_name: true, user_id: true } }
            },
            orderBy: { start_time: 'asc' }
        });

        // 3. Check for Active Live Status
        const enhancedSchedule = await Promise.all(schedule.map(async (slot) => {
            const activeClass = await prisma.live_lectures.findFirst({
                where: {
                    instructor_id: slot.instructor_id,
                    status: 'live',
                    // Check if a live room was created in the last 12 hours
                    start_time: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } 
                }
            });

            return {
                ...slot,
                is_live_now: !!activeClass,
                live_lecture_id: activeClass?.live_lecture_id,
                room_id: activeClass?.room_id
            };
        }));

        return enhancedSchedule;
    }

    // NEW: Join a Live Lecture
    // 1. Checks if lecture is valid
    // 2. Marks Attendance as 'present'
    // 3. Returns VideoSDK Token & Room ID
    static async joinLiveLecture(userId: number, liveLectureId: number) {

        // A. Verify Lecture Exists
        const lecture = await prisma.live_lectures.findUnique({
            where: { live_lecture_id: liveLectureId }
        });

        if (!lecture) throw new AppError("Live lecture not found", 404);
        if (lecture.status === 'completed') throw new AppError("This class has ended.", 400);

        // B. Mark Attendance
        // We use upsert to ensure we don't duplicate if they rejoin
        await prisma.attendance.upsert({
            where: {
                live_lecture_id_user_id: {
                    live_lecture_id: liveLectureId,
                    user_id: userId
                }
            },
            update: { status: 'present' }, // If exists, ensure it's present
            create: {
                live_lecture_id: liveLectureId,
                user_id: userId,
                status: 'present'
            }
        });

        // C. Generate Token
        const token = generateVideoSDKToken('participant');

        return {
            token,
            roomId: lecture.room_id,
            meetingUrl: lecture.meeting_url
        };
    }

    static async getAttendance(userId: number) {
        // Fetch all attendance records for this user
        const records = await prisma.attendance.findMany({
            where: { user_id: userId },
            include: {
                live_lecture: {
                    include: {
                        lesson: { select: { title: true } } // Get class topic name
                    }
                }
            },
            orderBy: { recorded_at: 'desc' }
        });

        // Format it nicely for the frontend
        return records.map(record => ({
            date: record.recorded_at,
            status: record.status,
            topic: record.live_lecture.lesson.title
        }));
    }

    // NEW: Get Weekly Timetable for all enrolled courses
    static async getWeeklyTimetable(userId: number) {
        // 1. Get Enrolled Course IDs
        const enrollments = await prisma.enrollments.findMany({
            where: { user_id: userId },
            select: { course_id: true }
        });
        const courseIds = enrollments.map(e => e.course_id);

        if (courseIds.length === 0) return [];

        // 2. Fetch ALL schedule slots for these courses (No day filter)
        const schedule = await prisma.time_table.findMany({
            where: { course_id: { in: courseIds } },
            include: {
                course: { select: { title: true, thumbnail_url: true } },
                // ✅ Select Instructor Name
                instructor: { select: { full_name: true } },
                // ✅ Select Subject/Topic (Module Title)
                module: { select: { title: true } }
            },
            orderBy: [
                { course_id: 'asc' }, 
                { start_time: 'asc' }
            ]
        });

        return schedule;
    }
}