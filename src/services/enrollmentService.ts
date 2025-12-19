import prisma from "../utils/prisma";
import { BadRequestError } from "../utils/errors";


class EnrollmentService {
  
  // 1. Enroll User (Simple version for Free courses / Admin manual add)
  // For paid courses, this will be called via Webhook later.
  static async enrollUser(userId: number, courseId: number) {
    // Check if course exists
    const course = await prisma.courses.findUnique({ where: { course_id: courseId } });
    if (!course) throw new BadRequestError("Course not found");

    // Check if already enrolled
    const existing = await prisma.enrollments.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId
        }
      }
    });

    if (existing) throw new BadRequestError("User already enrolled");

    return await prisma.enrollments.create({
      data: {
        user_id: userId,
        course_id: courseId,
        completion_status: 'in_progress'
      }
    });
  }

  // 2. Get "My Courses" (Performance Optimized)
  static async getMyCourses(userId: number) {
    // We join Enrollments -> Course
    const enrollments = await prisma.enrollments.findMany({
      where: { user_id: userId },
      include: {
        course: {
          select: {
            course_id: true,
            title: true,
            thumbnail_url: true,
            description: true
          }
        }
      },
      orderBy: { enrollment_date: 'desc' }
    });

    // Flatten structure for frontend convenience
    return enrollments.map(e => ({
      ...e.course,
      enrollment_date: e.enrollment_date,
      status: e.completion_status
    }));
  }
}

export default EnrollmentService;