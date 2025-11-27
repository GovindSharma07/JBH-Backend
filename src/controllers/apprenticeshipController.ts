import { Request, Response } from "express";
import ApprenticeshipService from "../services/apprenticeshipService";
import { AuthenticatedRequest } from "../utils/types";
import { ApiError, BadRequestError } from "../utils/errors";

class ApprenticeshipController {
  
  // 1. Create a new Apprenticeship (Admin/Instructor)
  static create = async (req: Request, res: Response) => {
    try {
      // We pass req.body directly, or you can destructure specific fields to be safe
      const newApprenticeship = await ApprenticeshipService.createApprenticeship(req.body);

      return res.status(201).json({
        message: "Apprenticeship created successfully",
        data: newApprenticeship,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // 2. Get All Apprenticeships (Public/Student)
  static getAll = async (req: Request, res: Response) => {
    try {
      const list = await ApprenticeshipService.getAllApprenticeships();
      return res.status(200).json(list);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // 3. Get Single Apprenticeship Details
  static getOne = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await ApprenticeshipService.getApprenticeshipById(Number(id));
      return res.status(200).json(item);
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // 4. Apply for an Apprenticeship (Student)
  static apply = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userPayload = req.user as { userId: number };
      const userId = userPayload.userId;
      const { apprenticeship_id } = req.body;

      if (!userId || !apprenticeship_id) {
        throw new BadRequestError("Invalid data provided");
      }

      const application = await ApprenticeshipService.applyForApprenticeship(
        userId,
        Number(apprenticeship_id)
      );

      return res.status(201).json({
        message: "Application submitted successfully",
        applicationId: application.application_id,
      });

    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };
}

export default ApprenticeshipController;