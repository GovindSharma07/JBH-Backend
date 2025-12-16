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

    const lastLesson = await prisma.lessons.findFirst({
      where: { module_id: data.moduleId },
      orderBy: { lesson_order: 'desc' }
    });
    const newOrder = (lastLesson?.lesson_order ?? 0) + 1;

    const lesson = await prisma.lessons.create({
      data: {
        module_id: data.moduleId,
        title: data.title,
        content_url: data.contentUrl,
        content_type: data.contentType,
        // FIX: Convert undefined to null
        duration: data.duration ?? null, 
        is_free: data.isFree ?? false,
        lesson_order: newOrder
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

  static async updateLesson(lessonId: number, data: any) {
    const updateData: any = {};
    // Only include fields that are actually present in the request
    if (data.title !== undefined) updateData.title = data.title;
    if (data.contentUrl !== undefined) updateData.content_url = data.contentUrl;
    if (data.contentType !== undefined) updateData.content_type = data.contentType;
    // Handle nullable duration specifically
    if (data.duration !== undefined) updateData.duration = data.duration ?? null;
    if (data.isFree !== undefined) updateData.is_free = data.isFree;
    if (data.order !== undefined) updateData.lesson_order = data.order;

    return await prisma.lessons.update({
      where: { lesson_id: lessonId },
      data: updateData
    });
  }

  static async deleteLesson(lessonId: number) {
    return await prisma.lessons.delete({
      where: { lesson_id: lessonId }
    });
  }

  // NEW: Reorder Lessons
  static async reorderLessons(moduleId: number, updates: { id: number; order: number }[]) {
    return await prisma.$transaction(
      updates.map((u) =>
        prisma.lessons.update({
          where: { lesson_id: u.id, module_id: moduleId },
          data: { lesson_order: u.order },
        })
      )
    );
  }
}

export default LessonService;