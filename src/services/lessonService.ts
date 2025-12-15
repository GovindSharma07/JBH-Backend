import { PrismaClient } from "../generated/prisma/client";
import { BadRequestError } from "../utils/errors";

const prisma = new PrismaClient();

class LessonService {
  
  static async addLesson(data: {
    moduleId: number;
    title: string;
    contentUrl: string;
    contentType: 'video' | 'pdf';
    duration?: number | undefined; 
    isFree?: boolean | undefined;
  }) {
    // Verify module exists
    const moduleExists = await prisma.syllabus_modules.findUnique({
      where: { module_id: data.moduleId }
    });
    if (!moduleExists) throw new BadRequestError("Module not found");

    const count = await prisma.lessons.count({
      where: { module_id: data.moduleId }
    });

    const lesson = await prisma.lessons.create({
      data: {
        module_id: data.moduleId,
        title: data.title,
        content_url: data.contentUrl,
        content_type: data.contentType,
        // FIX: Convert undefined to null
        duration: data.duration ?? null, 
        is_free: data.isFree ?? false,
        lesson_order: count + 1
      }
    });

    return lesson;
  }

  static async getLessonById(userId: number, lessonId: number) {
    const lesson = await prisma.lessons.findUnique({
      where: { lesson_id: lessonId },
      include: { module: true }
    });

    if (!lesson) throw new BadRequestError("Lesson not found");

    if (lesson.is_free) return lesson;

    const enrollment = await prisma.enrollments.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: lesson.module.course_id
        }
      }
    });

    if (!enrollment) {
      throw new BadRequestError("You must enroll in this course to view this lesson.");
    }

    return lesson;
  }
}

export default LessonService;