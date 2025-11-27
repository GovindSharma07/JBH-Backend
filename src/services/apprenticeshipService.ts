import { PrismaClient } from "../generated/prisma/client"; // Adjust path as needed
import { ApiError, BadRequestError } from "../utils/errors";

// Use the singleton pattern or pass the datasource url if using Prisma 6+
const prisma = new PrismaClient();

class ApprenticeshipService {
  
  static async createApprenticeship(data: {
    company_name: string;
    title: string;
    description: string;
    location: string;
    stipend: number; // Decimal in DB, typically passed as number/string in JS
  }) {
    return await prisma.apprenticeships.create({
      data: {
        company_name: data.company_name,
        title: data.title,
        description: data.description,
        location: data.location,
        stipend: data.stipend,
      },
    });
  }

  static async getAllApprenticeships() {
    return await prisma.apprenticeships.findMany({
      orderBy: { posted_at: 'desc' },
    });
  }

  static async getApprenticeshipById(id: number) {
    const item = await prisma.apprenticeships.findUnique({
      where: { apprenticeship_id: id },
    });

    if (!item) {
      throw new ApiError("Apprenticeship not found", 404);
    }

    return item;
  }

  static async applyForApprenticeship(userId: number, apprenticeshipId: number) {
    // Check if already applied
    const existingApplication = await prisma.apprenticeship_applications.findFirst({
      where: {
        user_id: userId,
        apprenticeship_id: apprenticeshipId,
      },
    });

    if (existingApplication) {
      throw new BadRequestError("You have already applied for this position.");
    }

    return await prisma.apprenticeship_applications.create({
      data: {
        user_id: userId,
        apprenticeship_id: apprenticeshipId,
        status: 'pending',
      },
    });
  }
}

export default ApprenticeshipService;