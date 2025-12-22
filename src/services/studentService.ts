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

        // Date Range for TODAY
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

        // 2. Get Schedule
        const schedule = await prisma.time_table.findMany({
            where: {
                course_id: { in: courseIds },
                OR: [
                    { schedule_type: 'recurring', day_of_week: { equals: todayName, mode: 'insensitive' } },
                    { schedule_type: 'one-time', specific_date: { gte: startOfDay, lte: endOfDay } }
                ]
            },
            include: {
                course: { select: { title: true, thumbnail_url: true } },
                module: { select: { title: true } },
                instructor: { select: { full_name: true, user_id: true } }
            },
            orderBy: { start_time: 'asc' }
        });

        // 3. Check for Active Live Status (FIXED LOGIC)
        const enhancedSchedule = await Promise.all(schedule.map(async (slot) => {
            // A. Fetch ANY active live class for this course/instructor
            const activeClass = await prisma.live_lectures.findFirst({
                where: {
                    instructor_id: slot.instructor_id,
                    status: 'live',
                    lesson: { module: { course_id: slot.course_id } },
                    // Started in the last 12 hours
                    start_time: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) }
                }
            });

            // B. [CRITICAL FIX] Verify Time Match
            // Only attach the live class if it matches this specific SLOT'S time.
            let isMatch = false;

            if (activeClass) {
                // Parse Slot Start Time (e.g., "14:30")
                const [hours, minutes] = slot.start_time.split(':').map(Number);
                const slotDate = new Date(today);
                slotDate.setHours(hours ?? 12, minutes, 0, 0);

                // Calculate difference in Minutes
                const diffMs = Math.abs(activeClass.start_time.getTime() - slotDate.getTime());
                const diffMins = diffMs / (1000 * 60);

                // MATCH CONDITION: 
                // The live class must have started within 90 mins of the scheduled slot.
                // This prevents the 10:00 AM slot from grabbing the 2:00 PM live class.
                if (diffMins < 90) {
                    isMatch = true;
                }
            }

            return {
                ...slot,
                // Only mark true if we found a class AND the times are close
                is_live_now: isMatch,
                live_lecture_id: isMatch ? activeClass?.live_lecture_id : null,
                room_id: isMatch ? activeClass?.room_id : null
            };
        }));

        return enhancedSchedule;
    }

    // NEW: Join a Live Lecture
    static async joinLiveLecture(userId: number, liveLectureId: number) {
        const lecture = await prisma.live_lectures.findUnique({
            where: { live_lecture_id: liveLectureId }
        });

        if (!lecture) throw new AppError("Live lecture not found", 404);
        if (lecture.status === 'completed') throw new AppError("This class has ended.", 400);

        await prisma.attendance.upsert({
            where: {
                live_lecture_id_user_id: {
                    live_lecture_id: liveLectureId,
                    user_id: userId
                }
            },
            update: { status: 'present' },
            create: {
                live_lecture_id: liveLectureId,
                user_id: userId,
                status: 'present'
            }
        });

        const token = generateVideoSDKToken('participant');

        return { token, roomId: lecture.room_id, meetingUrl: lecture.meeting_url };
    }

    static async getAttendance(userId: number) {
        const records = await prisma.attendance.findMany({
            where: { user_id: userId },
            include: {
                live_lecture: {
                    include: { lesson: { select: { title: true } } }
                }
            },
            orderBy: { recorded_at: 'desc' }
        });

        return records.map(record => ({
            date: record.recorded_at,
            status: record.status,
            topic: record.live_lecture.lesson.title
        }));
    }

    static async getWeeklyTimetable(userId: number) {
        const enrollments = await prisma.enrollments.findMany({
            where: { user_id: userId },
            select: { course_id: true }
        });
        const courseIds = enrollments.map(e => e.course_id);
        if (courseIds.length === 0) return [];

        const schedule = await prisma.time_table.findMany({
            where: { course_id: { in: courseIds } },
            include: {
                course: { select: { title: true, thumbnail_url: true } },
                instructor: { select: { full_name: true } },
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