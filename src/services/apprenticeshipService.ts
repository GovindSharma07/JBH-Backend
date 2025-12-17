// src/services/apprenticeshipService.ts

import { PrismaClient } from "../generated/prisma/client";
import { AppError, BadRequestError } from "../utils/errors";
import redisClient from "../utils/redisClient";
import ResumeService from "./resumeService";

const prisma = new PrismaClient();

class ApprenticeshipService {
  
  // Admin: Create new
  static async createApprenticeship(data: {
    company_name: string;
    title: string;
    description: string;
    location: string;
    duration: string;
    stipend: number;
    image_url: string;
  }) {
    const newJob = await prisma.apprenticeships.create({
      data: {
        company_name: data.company_name,
        title: data.title,
        description: data.description,
        location: data.location,
        duration: data.duration,
        stipend: data.stipend,
        image_url: data.image_url,
        is_active: true
      },
    });

    await redisClient.del("apprenticeships:all");
    return newJob;
  }

  // Student: Get all open positions with "Applied" status
 static async getAllApprenticeships(userId: number) {
    const cacheKey = "apprenticeships:all";

    // 1. Try to get the MASTER LIST from Redis
    let allPositions;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      // HIT: Parse data from Redis
      allPositions = JSON.parse(cachedData);
    } else {
      // MISS: Fetch from Database
      allPositions = await prisma.apprenticeships.findMany({
        where: { is_active: true },
        orderBy: { posted_at: 'desc' },
      });

      // Write to Redis (Expire in 1 hour or 1 day)
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(allPositions));
    }

    // 2. Fetch User's Applications (Always from DB, but fast)
    // This query is lightweight compared to fetching the full job list
    const userApplications = await prisma.apprenticeship_applications.findMany({
      where: { user_id: userId },
      select: { apprenticeship_id: true, status: true }
    });

    // 3. Merge in memory
    return allPositions.map((pos: any) => {
      const app = userApplications.find(a => a.apprenticeship_id === pos.apprenticeship_id);
      return {
        ...pos,
        has_applied: !!app,
        application_status: app ? app.status : null
      };
    });
  }

  // Basic Get One
  static async getApprenticeshipById(id: number) {
    const item = await prisma.apprenticeships.findUnique({
      where: { apprenticeship_id: id },
    });
    if (!item) throw new AppError("Apprenticeship not found", 404);
    return item;
  }

  // Student: Apply
  static async applyForApprenticeship(userId: number, data: { 
    apprenticeship_id: number, 
    resume_id: number, // CHANGED: Now accepts ID
    message?: string 
  }) {
    // 1. Check if position exists/active
    const position = await prisma.apprenticeships.findUnique({
        where: { apprenticeship_id: data.apprenticeship_id }
    });

    if (!position || !position.is_active) {
        throw new BadRequestError("This apprenticeship is no longer accepting applications.");
    }

    // 2. Check if already applied
    const existing = await prisma.apprenticeship_applications.findFirst({
      where: {
        user_id: userId,
        apprenticeship_id: data.apprenticeship_id,
      },
    });

    if (existing) {
      throw new BadRequestError("You have already applied for this position.");
    }

    // 3. FETCH RESUME URL using the ID
    const resumeRecord = await ResumeService.getResumeById(userId, data.resume_id);
    
    if (!resumeRecord) {
        throw new BadRequestError("Invalid resume selected.");
    }

    // 4. Create Application (Store the URL as a snapshot)
    return await prisma.apprenticeship_applications.create({
      data: {
        user_id: userId,
        apprenticeship_id: data.apprenticeship_id,
        resume_url: resumeRecord.file_url, // Use the fetched URL
        message: data.message ?? null,
        status: 'pending',
      },
    });
  }

  // Admin: Get All Applied Data
  static async getAllApplications() {
    return await prisma.apprenticeship_applications.findMany({
        include: {
            user: {
                select: { full_name: true, email: true, phone: true }
            },
            apprenticeship: {
                select: { title: true, company_name: true }
            }
        },
        orderBy: { submitted_at: 'desc' }
    });
  }
}

export default ApprenticeshipService;