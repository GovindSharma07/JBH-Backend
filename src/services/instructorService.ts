import { PrismaClient } from '../generated/prisma/client';
import { AppError } from '../utils/errors';
import { createMeetingRoom } from '../utils/videoSdkClient';

const prisma = new PrismaClient();

export class InstructorService {

    // 1. Get Instructor's Specific Schedule for TODAY
    static async getMySchedule(instructorId: number) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // FIX: Add 'as string' to force TypeScript to treat this as a string
        const todayName = days[new Date().getDay()] as string;

        console.log(`Fetching schedule for Instructor ${instructorId} on ${todayName}`);

        return await prisma.time_table.findMany({
            where: {
                instructor_id: instructorId,
                // Now 'todayName' is strictly a string, so this works
                day_of_week: { equals: todayName, mode: 'insensitive' }
            },
            include: {
                course: { select: { title: true, thumbnail_url: true } },
                module: { select: { title: true } } // Subject Name (e.g. Math)
            },
            orderBy: { start_time: 'asc' }
        });
    }
    static async startLiveClass(userId: number, scheduleId: number, topic: string) {
        // 1. Fetch Schedule Details
        const schedule = await prisma.time_table.findUnique({
            where: { schedule_id: scheduleId },
            include: { course: true }
        });

        if (!schedule) throw new AppError("Schedule not found", 404);
        if (schedule.instructor_id !== userId) throw new AppError("Unauthorized", 403);

        // 2. Generate Dynamic Module Name
        const todayStr = new Date().toDateString();
        const moduleName = `Classes - ${todayStr}`;

        // 3. Find or Create the Module
        // Uses 'syllabus_modules' table name correctly
        let module = await prisma.syllabus_modules.findFirst({
            where: {
                course_id: schedule.course_id,
                title: moduleName
            }
        });

        if (!module) {
            // Uses 'syllabus_modules' and 'module_order' correctly
            const lastModule = await prisma.syllabus_modules.findFirst({
                where: { course_id: schedule.course_id },
                orderBy: { module_order: 'desc' }
            });
            const newOrder = (lastModule?.module_order || 0) + 1;

            module = await prisma.syllabus_modules.create({
                data: {
                    course_id: schedule.course_id,
                    title: moduleName,
                    module_order: newOrder
                }
            });
        }

        // 4. Create the Lesson Placeholder
        const lesson = await prisma.lessons.create({
            data: {
                module_id: module.module_id,
                title: topic || "Live Session",
                content_type: 'live',
                content_url: '',
                is_free: false,
                lesson_order: 1
            }
        });

        // 5. Create VideoSDK Room
        const roomId = await createMeetingRoom();

        // 6. Define Start and Estimated End Time (Fix for the error)
        const startTime = new Date();
        const estimatedEndTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Default to +1 hour

        // 7. Create Live Lecture Entry
        const liveLecture = await prisma.live_lectures.create({
            data: {
                room_id: roomId,
                instructor_id: userId,
                lesson_id: lesson.lesson_id,
                start_time: startTime,
                end_time: estimatedEndTime, // <--- FIXED: Added required field
                status: 'live'
            }
        });

        return {
            roomId,
            liveLectureId: liveLecture.live_lecture_id,
            lessonId: lesson.lesson_id
        };
    }
}