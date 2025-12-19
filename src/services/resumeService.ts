import prisma from "../utils/prisma";
import { BadRequestError, UserNotFoundError } from "../utils/errors";


class ResumeService {
  static async addResume(userId: number, data: { name: string; file_url: string }) {
    // Limit resumes to 5 per user
    const count = await prisma.resumes.count({ where: { user_id: userId } });
    if (count >= 5) throw new BadRequestError("You can only upload up to 5 resumes.");

    return await prisma.resumes.create({
      data: {
        user_id: userId,
        name: data.name,
        file_url: data.file_url,
      },
    });
  }

  static async getUserResumes(userId: number) {
    return await prisma.resumes.findMany({
      where: { user_id: userId },
      orderBy: { uploaded_at: 'desc' }
    });
  }

  static async getResumeById(userId: number, resumeId: number) {
    return await prisma.resumes.findFirst({
        where: { resume_id: resumeId, user_id: userId }
    });
  }

  static async deleteResume(userId: number, resumeId: number) {
    // Check ownership
    const resume = await prisma.resumes.findFirst({
      where: { resume_id: resumeId, user_id: userId }
    });

    if (!resume) throw new UserNotFoundError("Resume not found.");

    return await prisma.resumes.delete({
      where: { resume_id: resumeId }
    });
  }
}

export default ResumeService;