// src/services/courseService.ts
import { PrismaClient } from "../generated/prisma/client";
import redisClient from "../utils/redisClient";
import { BadRequestError } from "../utils/errors";

const prisma = new PrismaClient();
const CACHE_KEY_ALL = "courses:all_summary";     // Key for Admins (contains drafts)
const CACHE_KEY_PUBLIC = "courses:public_summary"; // Key for Students (published only)

class CourseService {
  
  // ... (Keep existing getAllCourses, getCourseById, createCourse) ...
  // Keep your existing methods here, I am adding the NEW ones below:

  static async getAllCourses(isAdmin: boolean = false) {
    // 1. Determine which Cache Key to use
    const cacheKey = isAdmin ? CACHE_KEY_ALL : CACHE_KEY_PUBLIC;

    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const whereClause = isAdmin ? {} : { is_published: true };

    const courses = await prisma.courses.findMany({
      where: whereClause,
      select: {
        course_id: true,
        title: true,
        description: true,
        thumbnail_url: true,
        price: true,
        created_at: true,
        is_published: true
      },
      orderBy: { created_at: 'desc' }
    });

    // 5. Cache the result (expire in 1 hour)
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(courses));
    
    return courses;
  }

static async getCourseById(courseId: number) {
  return prisma.courses.findUnique({
    where: { course_id: courseId },
    include: {
      modules: {
        orderBy: [
          { module_order: 'asc' }, 
          { module_id: 'asc' } // Tie-breaker for modules
        ], 
        include: { 
          lessons: { 
            orderBy: [
              { lesson_order: 'asc' }, // Primary sort
              { lesson_id: 'asc' }     // Secondary sort (Fixes the 0,0,0 issue)
            ]
          } 
        }
      }
    }
  });
  }

  static async createCourse(data: any) {
    const course = await prisma.courses.create({
      data: {
        title: data.title,
        description: data.description,
        price: data.price,
        thumbnail_url: data.thumbnail_url,
      }
    });
    await redisClient.del(CACHE_KEY_ALL); // Invalidate Cache
    return course;
  }

  // --- NEW METHODS START ---

  // Update Course
  static async updateCourse(id: number, data: any) {
    const course = await prisma.courses.update({
      where: { course_id: id },
      data: {
        title: data.title,
        description: data.description,
        price: data.price,
        thumbnail_url: data.thumbnail_url,
      }
    });
    await redisClient.del(CACHE_KEY_ALL); // Invalidate Cache
    return course;
  }

  // Delete Course
  static async deleteCourse(id: number) {
    // Prisma cascade will handle modules/lessons if configured, 
    // but explicit delete is safer for cache clearing logic
    await prisma.courses.delete({ where: { course_id: id } });
    await redisClient.del(CACHE_KEY_ALL); // Invalidate Cache
    return true;
  }

  // --- MODULES ---

  // Add Module (Existing)
  static async addModule(courseId: number, title: string, order: number) {
    return await prisma.syllabus_modules.create({
      data: { course_id: courseId, title: title, module_order: order }
    });
  }

  // Update Module
  static async updateModule(moduleId: number, title: string, order?: number) {
    // Dynamically build object to avoid undefined issues
    const updateData: any = { title };
    if (order !== undefined) {
      updateData.module_order = order;
    }

    return await prisma.syllabus_modules.update({
      where: { module_id: moduleId },
      data: updateData
    });
  }

  // Delete Module
  static async deleteModule(moduleId: number) {
    return await prisma.syllabus_modules.delete({
      where: { module_id: moduleId }
    });
  }

  // --- NEW METHODS END ---

  // NEW: Reorder Modules
  static async reorderModules(courseId: number, updates: { id: number; order: number }[]) {
    // Use a transaction to update all at once
    return await prisma.$transaction(
      updates.map((u) =>
        prisma.syllabus_modules.update({
          where: { module_id: u.id, course_id: courseId }, // Ensure courseId matches for security
          data: { module_order: u.order },
        })
      )
    );
  }
}

export default CourseService;