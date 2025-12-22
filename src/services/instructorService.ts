// src/services/instructorService.ts

import prisma from "../utils/prisma";
import { AppError } from "../utils/errors";
import { createMeetingRoom } from "../utils/videoSdkClient"; // Ensure this import exists
import { getISTDate } from "../utils/time";


class InstructorService {

  /**
   * 1. Get Instructor Dashboard Data
   * Fetches Today's Schedule (Recurring + One-Time) and Courses
   */
  static async getDashboardData(instructorId: number) {
    const todaySchedule = await this.getMySchedule(instructorId);

    // Get all unique courses this instructor is assigned to
    const myCourses = await prisma.time_table.findMany({
      where: { instructor_id: instructorId },
      distinct: ['course_id'],
      select: {
        course: {
          select: {
            course_id: true,
            title: true,
            thumbnail_url: true,
            description: true
          }
        }
      }
    });

    // Get upcoming "Special Lectures" (One-time events in the future)
    const upcomingSpecial = await prisma.time_table.findMany({
      where: {
        instructor_id: instructorId,
        schedule_type: 'one-time',
        specific_date: { gt: new Date() }
      },
      include: { course: true },
      orderBy: { specific_date: 'asc' },
      take: 5
    });

    return {
      todaySchedule,
      courses: myCourses.map(c => c.course),
      upcomingSpecial
    };
  }

  /**
   * 2. Get Today's Schedule
   * Helper function for dashboard
   */
  static async getMySchedule(instructorId: number) {
    const today = getISTDate();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = days[today.getDay()] || '';

    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    return await prisma.time_table.findMany({
      where: {
        instructor_id: instructorId,
        OR: [
          // Recurring classes for today
          {
            schedule_type: 'recurring',
            day_of_week: { equals: todayName, mode: 'insensitive' },
          },
          // One-Time classes specifically for today
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
        course: {
          select: { title: true, course_id: true, thumbnail_url: true }
        }
      },
      orderBy: { start_time: 'asc' }
    });
  }

  /**
   * 3. Start Live Class
   * Creates Room, Lesson, and Live Lecture Entry
   */
  static async startLiveClass(userId: number, scheduleId: number, topic: string) {
    // A. Verify Schedule Access
    const schedule = await prisma.time_table.findUnique({
      where: { schedule_id: scheduleId },
      include: { course: true }
    });

    if (!schedule) throw new AppError("Schedule not found", 404);
    if (schedule.instructor_id !== userId) throw new AppError("Unauthorized access to this schedule", 403);

    // B. Check for EXISTING Live Class (Resume Logic)
    const existingLive = await prisma.live_lectures.findFirst({
      where: {
        instructor_id: userId,
        status: 'live',

        // [FIX] ADD THIS: Only resume if it matches the requested COURSE
        lesson: {
          module: {
            course_id: schedule.course_id
          }
        },

        start_time: { gte: new Date(new Date().getTime() - 12 * 60 * 60 * 1000) }
      }
    });

    if (existingLive) {
      return {
        roomId: existingLive.room_id,
        liveLectureId: existingLive.live_lecture_id,
        lessonId: existingLive.lesson_id,
        message: "Resuming existing active session"
      };
    }

    // [FIX] C. Group Modules by Month using IST Date
    const istDate = getISTDate();
    // Get Month Name (e.g., "December")
    const monthName = istDate.toLocaleString('default', { month: 'long' });
    const year = istDate.getFullYear();

    // Module Name: "Live Classes - December 2025"
    const moduleName = `Live Classes - ${monthName} ${year}`;

    // Use Transaction to prevent race conditions during creation
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or Create Module
      let module = await tx.syllabus_modules.findFirst({
        where: {
          course_id: schedule.course_id,
          title: moduleName
        }
      });

      if (!module) {
        // Find the last module order
        const lastModule = await tx.syllabus_modules.findFirst({
          where: { course_id: schedule.course_id },
          orderBy: { module_order: 'desc' }
        });
        const newOrder = (lastModule?.module_order || 0) + 1;

        module = await tx.syllabus_modules.create({
          data: {
            course_id: schedule.course_id,
            title: moduleName,
            module_order: newOrder
          }
        });
      }

      // 2. Calculate Lesson Order
      const lastLesson = await tx.lessons.findFirst({
        where: { module_id: module.module_id },
        orderBy: { lesson_order: 'desc' }
      });
      const nextLessonOrder = (lastLesson?.lesson_order || 0) + 1;

      // 3. Create Lesson Placeholder
      const lesson = await tx.lessons.create({
        data: {
          module_id: module.module_id,
          title: `${topic} (${istDate.getDate()} ${monthName})`, // e.g. "Physics (17 December)"
          content_type: 'live',
          content_url: '',
          is_free: false,
          lesson_order: nextLessonOrder
        }
      });

      // 4. Create VideoSDK Room
      // (Note: We call external API outside transaction usually, but here needed for DB insert. 
      // If API fails, transaction rolls back, which is good.)
      const roomId = await createMeetingRoom();

      const startTime = new Date(); // Server time for DB is fine, as long as Logic used IST
      const estimatedEndTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const liveLecture = await tx.live_lectures.create({
        data: {
          room_id: roomId,
          instructor_id: userId,
          lesson_id: lesson.lesson_id,
          start_time: startTime,
          end_time: estimatedEndTime,
          status: 'live'
        }
      });

      return { roomId, liveLecture, lesson };
    });

    return {
      roomId: result.roomId,
      liveLectureId: result.liveLecture.live_lecture_id,
      lessonId: result.lesson.lesson_id,
      message: "Class started successfully"
    };
  }

  /**
   * 4. End Live Class
   */
  static async endLiveClass(userId: number, liveLectureId: number) {
    const lecture = await prisma.live_lectures.findUnique({
      where: { live_lecture_id: liveLectureId }
    });

    if (!lecture) throw new AppError("Lecture not found", 404);
    if (lecture.instructor_id !== userId) throw new AppError("Unauthorized", 403);

    return await prisma.live_lectures.update({
      where: { live_lecture_id: liveLectureId },
      data: {
        status: 'completed',
        end_time: new Date()
      }
    });
  }
}

export default InstructorService;