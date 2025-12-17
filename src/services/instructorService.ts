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

  // 2. Go Live: Start a Class from a Schedule Slot
  static async startLiveClass(instructorId: number, scheduleId: number, topic: string) {
    // A. Verify this slot belongs to this instructor
    const slot = await prisma.time_table.findFirst({
      where: { 
        schedule_id: scheduleId, 
        instructor_id: instructorId 
      }
    });

    if (!slot) throw new AppError("Unauthorized: This is not your class slot.", 403);

    // B. Create VideoSDK Room
    const roomId = await createMeetingRoom();

    // C. Database Transaction: Create Lesson + LiveLecture
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create a Lesson entry (so it appears in syllabus later)
      const lesson = await tx.lessons.create({
        data: {
          module_id: slot.module_id!, // Assumes slot has module_id
          title: topic || "Live Session", 
          content_type: 'live',
          lesson_order: 100 // Logic to put at end of list
        }
      });

      // 2. Create the Live Lecture instance
      const liveLecture = await tx.live_lectures.create({
        data: {
          lesson_id: lesson.lesson_id,
          room_id: roomId,
          instructor_id: instructorId,
          start_time: new Date(),
          end_time: new Date(Date.now() + 60 * 60 * 1000), // Default 1 hour
          status: 'live'
        }
      });

      return { roomId, liveLectureId: liveLecture.live_lecture_id };
    });

    return result;
  }
}