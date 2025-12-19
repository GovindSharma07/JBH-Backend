import prisma from "../utils/prisma";
import { BadRequestError } from "../utils/errors"; // Assuming you have an AppError or NotFoundError class too
import bcrypt from "bcryptjs";
import redisClient from "../utils/redisClient";
import { validateEmail, validatePassword } from "../utils/validation";
import { generatePresignedUploadUrl } from "../utils/storage";


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

  // 5. Create Schedule Slot (Updated)
  static async createScheduleSlot(data: any) {
    const {
      courseId,
      instructorId,
      moduleId,
      startTime,
      endTime,
      scheduleType, // 'recurring' | 'one-time'
      dayOfWeek,    // Required if recurring
      validFrom,    // Optional range start
      validTo,      // Optional range end
      specificDate  // Required if one-time
    } = data;

    // A. Basic Validation
    if (!courseId || !instructorId || !startTime || !endTime || !scheduleType) {
      throw new BadRequestError("Missing required fields.");
    }

    const instructorIdNum = Number(instructorId);

    // B. Validate Logic based on Type
    let finalDayOfWeek = dayOfWeek;
    let finalSpecificDate = null;
    let finalValidFrom = validFrom ? new Date(validFrom) : null;
    let finalValidTo = validTo ? new Date(validTo) : null;

    if (scheduleType === 'one-time') {
      if (!specificDate) throw new BadRequestError("Date is required for one-time classes.");
      finalSpecificDate = new Date(specificDate);

      // Auto-set day of week for easier querying later? Or leave null.
      // Let's leave null to distinguish strictly.
      finalDayOfWeek = null;

    } else {
      // Recurring
      if (!dayOfWeek) throw new BadRequestError("Day of week is required for recurring classes.");
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (!validDays.includes(dayOfWeek)) throw new BadRequestError("Invalid dayOfWeek.");
    }

    // C. Check Conflicts (Simple Time Overlap Check)
    // Note: A robust system would check date ranges too, but let's keep it simple for now.
    // We check if this instructor is busy at this specific time on this specific day (or recurring day)

    // ... (Conflict logic can be expanded here)

    // D. Create Entry
    return await prisma.time_table.create({
      data: {
        course_id: Number(courseId),
        instructor_id: instructorIdNum,
        module_id: moduleId ? Number(moduleId) : null,
        schedule_type: scheduleType,
        day_of_week: finalDayOfWeek,
        start_time: startTime,
        end_time: endTime,
        valid_from: finalValidFrom,
        valid_to: finalValidTo,
        specific_date: finalSpecificDate
      }
    });
  }

  // 6. Delete Schedule Slot
  static async deleteScheduleSlot(scheduleId: number) {
    return await prisma.time_table.delete({ where: { schedule_id: scheduleId } });
  }
}