// src/services/instructorService.ts

import { PrismaClient } from "../generated/prisma/client";
import { AppError } from "../utils/errors";
import { createMeetingRoom } from "../utils/videoSdkClient"; // Ensure this import exists
import { getISTDate } from "../utils/time";

const prisma = new PrismaClient();

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
    
    const startOfDay = new Date(today.setHours(0,0,0,0));
    const endOfDay = new Date(today.setHours(23,59,59,999));

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
    // If the instructor crashed and rejoined within 12 hours, return the SAME room.
    const existingLive = await prisma.live_lectures.findFirst({
      where: {
        instructor_id: userId,
        status: 'live',
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

    // C. Create Module: "Classes - [Today's Date]"
    const todayStr = new Date().toDateString(); // e.g., "Mon Dec 25 2023"
    const moduleName = `Classes - ${todayStr}`;

    let module = await prisma.syllabus_modules.findFirst({
      where: {
        course_id: schedule.course_id,
        title: moduleName
      }
    });

    if (!module) {
      // Find the last module order to append to the end
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

    // D. Calculate Lesson Order
    const lastLesson = await prisma.lessons.findFirst({
      where: { module_id: module.module_id },
      orderBy: { lesson_order: 'desc' }
    });
    const nextLessonOrder = (lastLesson?.lesson_order || 0) + 1;

    // E. Create Lesson Placeholder
    const lesson = await prisma.lessons.create({
      data: {
        module_id: module.module_id,
        title: topic || "Live Session",
        content_type: 'live', // Ensure 'live' is in your ContentType enum
        content_url: '',
        is_free: false,
        lesson_order: nextLessonOrder
      }
    });

    // F. Create VideoSDK Room
    const roomId = await createMeetingRoom();

    // G. Create Live Lecture Entry
    const startTime = new Date();
    const estimatedEndTime = new Date(startTime.getTime() + 60 * 60 * 1000); // +1 hour

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
      lessonId: lesson.lesson_id,
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