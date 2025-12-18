import { PrismaClient } from '../generated/prisma/client';
import { AppError } from '../utils/errors';
import { getISTDate } from '../utils/time';
import { createMeetingRoom } from '../utils/videoSdkClient';

const prisma = new PrismaClient();

export class InstructorService {

    // 1. Get Instructor's Specific Schedule for TODAY
    static async getMySchedule(instructorId: number) {
        const today = getISTDate();

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // FIX: Add 'as string' to force TypeScript to treat this as a string
        const todayName = days[today.getDay()] as string;

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

    // --- NEW: CHECK FOR EXISTING LIVE CLASS ---
    // Prevents creating multiple rooms if the instructor refreshes or rejoins.
    const existingLive = await prisma.live_lectures.findFirst({
      where: {
        instructor_id: userId,
        status: 'live',
        // Check for classes started within the last 12 hours to avoid picking up stale data
        start_time: { gte: new Date(new Date().getTime() - 12 * 60 * 60 * 1000) } 
      }
    });

    if (existingLive) {
      return {
        roomId: existingLive.room_id,
        liveLectureId: existingLive.live_lecture_id,
        lessonId: existingLive.lesson_id,
        message: "Resuming existing active session" // Optional flag for frontend
      };
    }
    // ------------------------------------------

    // 2. Generate Dynamic Module Name
    const todayStr = new Date().toDateString();
    const moduleName = `Classes - ${todayStr}`;

    // 3. Find or Create the Module
    let module = await prisma.syllabus_modules.findFirst({
      where: {
        course_id: schedule.course_id,
        title: moduleName
      }
    });

    if (!module) {
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

    // --- NEW: CALCULATE LESSON ORDER ---
    // Fixes the hardcoded '1' so new lessons appear at the bottom
    const lastLesson = await prisma.lessons.findFirst({
      where: { module_id: module.module_id },
      orderBy: { lesson_order: 'desc' }
    });
    const nextLessonOrder = (lastLesson?.lesson_order || 0) + 1;
    // -----------------------------------

    // 4. Create the Lesson Placeholder
    const lesson = await prisma.lessons.create({
      data: {
        module_id: module.module_id,
        title: topic || "Live Session",
        content_type: 'live',
        content_url: '',
        is_free: false,
        lesson_order: nextLessonOrder // <--- Uses calculated order
      }
    });

    // 5. Create VideoSDK Room
    const roomId = await createMeetingRoom();

    // 6. Define Start and Estimated End Time
    const startTime = new Date();
    const estimatedEndTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Default +1 hr

    // 7. Create Live Lecture Entry
    const liveLecture = await prisma.live_lectures.create({
      data: {
        room_id: roomId,
        instructor_id: userId,
        lesson_id: lesson.lesson_id,
        start_time: startTime,
        end_time: estimatedEndTime,
        status: 'live'
      }
    });

    return {
      roomId,
      liveLectureId: liveLecture.live_lecture_id,
      lessonId: lesson.lesson_id
    };
  }

  static async endLiveClass(userId: number, liveLectureId: number) {
    const lecture = await prisma.live_lectures.findUnique({ where: { live_lecture_id: liveLectureId } });
    
    if (!lecture || lecture.instructor_id !== userId) throw new AppError("Unauthorized", 401);

    await prisma.live_lectures.update({
        where: { live_lecture_id: liveLectureId },
        data: { status: 'completed', end_time: new Date() }
    });
    
    return { success: true };
}
}