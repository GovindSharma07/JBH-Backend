import { PrismaClient } from "../generated/prisma/client";
import { BadRequestError } from "../utils/errors"; // Assuming you have an AppError or NotFoundError class too
import bcrypt from "bcryptjs";
import redisClient from "../utils/redisClient";
import { validateEmail, validatePassword } from "../utils/validation";
import { generatePresignedUploadUrl } from "../utils/storage";

const prisma = new PrismaClient();

export class AdminService {
  
  // 1. Get All Users
  static async getAllUsers() {
    return await prisma.users.findMany({
      select: {
        user_id: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        is_email_verified: true,
        is_phone_verified: true,
        created_at: true
      },
      orderBy: { created_at: 'desc' }
    });
  }

  // 2. Create User
  static async createUser(data: any) {
    const { full_name, email, password, phone, role } = data;

    // A. Validation
    if (!full_name || !email || !password || !phone || !role) {
      throw new BadRequestError("Email, password, and role are required.");
    }

    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) throw new BadRequestError("User already exists.");

    if (!validatePassword(password)) {
      throw new BadRequestError("Password weak. Must be 8+ chars with 1 upper, 1 lower, 1 number.");
    }

    if (!validateEmail(email)) {
      throw new BadRequestError("Invalid email format.");
    }

    // B. Logic
    const hashedPassword = await bcrypt.hash(password, 10);

    return await prisma.users.create({
      data: {
        full_name,
        email,
        password_hash: hashedPassword,
        phone,
        role,
        is_email_verified: true,
        is_phone_verified: true
      }
    });
  }

  // 3. Delete User
  static async deleteUser(userId: number) {
    // A. Delete from DB
    await prisma.users.delete({ where: { user_id: userId } });
    
    // B. Invalidate Redis Session
    await redisClient.del(`session:${userId}`);
    
    return true;
  }

  // 4. Generate Upload URL
  static async getUploadUrl(fileName: string, fileType: string, folder: string) {
    if (!fileName || !fileType) {
      throw new BadRequestError("File name and type are required");
    }

    const allowedFolders = ['courses', 'lessons', 'resumes', 'avatars'];
    const targetFolder = folder || 'courses';

    if (!allowedFolders.includes(targetFolder)) {
      throw new BadRequestError("Invalid upload folder");
    }

    return await generatePresignedUploadUrl(fileName, fileType, targetFolder);
  }

  // 5. Create Schedule Slot
  static async createScheduleSlot(data: any) {
    const { courseId, instructorId, moduleId, dayOfWeek, startTime, endTime } = data;

    // A. Basic Validation
    if (!courseId || !instructorId || !dayOfWeek || !startTime || !endTime) {
      throw new BadRequestError("Missing required fields.");
    }

    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!validDays.includes(dayOfWeek)) {
      throw new BadRequestError("Invalid dayOfWeek.");
    }

    // B. Conflict Check
    const conflict = await prisma.time_table.findFirst({
      where: {
        instructor_id: Number(instructorId),
        day_of_week: dayOfWeek,
        start_time: startTime
      }
    });

    if (conflict) {
      throw new BadRequestError("Conflict: This instructor already has a class at this time.");
    }

    // C. Create
    return await prisma.time_table.create({
      data: {
        course_id: Number(courseId),
        instructor_id: Number(instructorId),
        module_id: moduleId ? Number(moduleId) : null,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime
      }
    });
  }

  // 6. Delete Schedule Slot
  static async deleteScheduleSlot(scheduleId: number) {
    return await prisma.time_table.delete({ where: { schedule_id: scheduleId } });
  }
}