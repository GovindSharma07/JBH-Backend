import { PrismaClient } from '../generated/prisma/client';
const prisma = new PrismaClient();

export class StudentService {
  
  // Get Consolidated Timetable (Math + Physics + etc.)
  static async getTodayTimetable(userId: number) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // FIX: Add 'as string' to force TypeScript to treat this as a string, not 'string | undefined'
    const todayName = days[new Date().getDay()] as string;

    // 1. Find courses user is enrolled in
    const enrollments = await prisma.enrollments.findMany({
      where: { user_id: userId },
      select: { course_id: true }
    });
    
    const courseIds = enrollments.map(e => e.course_id);

    if (courseIds.length === 0) return [];

    // 2. Get Schedule for these courses
    const schedule = await prisma.time_table.findMany({
      where: {
        course_id: { in: courseIds },
        // Now 'todayName' is strictly a string, so this works
        day_of_week: { equals: todayName, mode: 'insensitive' }
      },
      include: {
        course: { select: { title: true, thumbnail_url: true } },
        module: { select: { title: true } }, // Subject
        instructor: { select: { full_name: true, user_id: true } } // Teacher Name
      },
      orderBy: { start_time: 'asc' }
    });

    // 3. (Advanced) Check if any of these are currently LIVE
    const enhancedSchedule = await Promise.all(schedule.map(async (slot) => {
      const activeClass = await prisma.live_lectures.findFirst({
        where: {
          instructor_id: slot.instructor_id,
          status: 'live',
          start_time: { gte: new Date(new Date().setHours(0,0,0,0)) } // Started today
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
}