import { PrismaClient } from "../generated/prisma/client";
import redisClient from "../utils/redisClient";
import { BadRequestError } from "../utils/errors";

const prisma = new PrismaClient();
const CACHE_TTL = 3600; // Cache lives for 1 hour

class CourseService {
  
  // 1. Get All Courses (Optimized for Feed)
  static async getAllCourses() {
    const cacheKey = "courses:all_summary";

    // A. Performance: Check Redis Cache first
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log("⚡ Fetching courses from Redis Cache");
      return JSON.parse(cachedData);
    }

    // B. Database Fallback (Lean Query)
    // We strictly select ONLY what is needed for the list card (No description/syllabus)
    const courses = await prisma.courses.findMany({
      select: {
        course_id: true,
        title: true,
        thumbnail_url: true,
        price: true,
        created_at: true
      },
      orderBy: { created_at: 'desc' }
    });

    // C. Save to Redis for next time
    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(courses));
    
    return courses;
  }

  // 2. Get Single Course (Full Details with Syllabus)
  static async getCourseById(courseId: number) {
    const course = await prisma.courses.findUnique({
      where: { course_id: courseId },
      include: {
        modules: {
          orderBy: { module_order: 'asc' }, // Keep chapters in order (1, 2, 3...)
          include: {
            lessons: {
              orderBy: { lesson_id: 'asc' } // Keep lessons in order
            }
          }
        }
      }
    });

    if (!course) throw new BadRequestError("Course not found");
    return course;
  }

  // 3. Create Course (Admin)
  static async createCourse(data: any) {
    const course = await prisma.courses.create({
      data: {
        title: data.title,
        description: data.description,
        price: data.price,
        thumbnail_url: data.thumbnail_url,
      }
    });

    // IMPORTANT: Invalidate cache so the new course appears immediately
    await redisClient.del("courses:all_summary");
    
    return course;
  }

  // 4. Add Module to Course (Admin)
  static async addModule(courseId: number, title: string, order: number) {
    return await prisma.syllabus_modules.create({
      data: {
        course_id: courseId,
        title: title,
        module_order: order
      }
    });
  }
}

export default CourseService;