import prisma from '../utils/prisma';

export class TimeTableService {
  
  // Get Schedule for a specific day (e.g., "Wednesday")
  static async getDailySchedule(userId: number, dayOfWeek: string) {
    // 1. Find all courses the user is enrolled in
    const enrollments = await prisma.enrollments.findMany({
      where: { user_id: userId },
      select: { course_id: true }
    });

    const courseIds = enrollments.map(e => e.course_id);

    if (courseIds.length === 0) return [];

    // 2. Find recurring timetable slots
    const recurringSlots = await prisma.time_table.findMany({
      where: {
        course_id: { in: courseIds },
        day_of_week: { equals: dayOfWeek, mode: 'insensitive' }
      },
      include: {
        course: { select: { title: true, thumbnail_url: true } }
      }
    });

    return recurringSlots;
  }

  // Get upcoming LIVE lectures (One-off sessions scheduled for today)
  static async getUpcomingLiveLectures(userId: number) {
    const enrollments = await prisma.enrollments.findMany({
      where: { user_id: userId },
      select: { course_id: true }
    });
    const courseIds = enrollments.map(e => e.course_id);

    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Find Live Lectures happening TODAY
    return await prisma.live_lectures.findMany({
      where: {
        start_time: {
          gte: now,
          lte: endOfDay
        },
        lesson: {
          module: {
            course_id: { in: courseIds }
          }
        }
      },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                 course: { select: { title: true } }
              }
            }
          }
        }
      },
      orderBy: { start_time: 'asc' }
    });
  }
}