// src/controllers/apprenticeshipController.ts

import { Request, Response } from "express";
import ApprenticeshipService from "../services/apprenticeshipService";
import { AuthenticatedRequest } from "../utils/types";
import { ApiError, BadRequestError } from "../utils/errors";
import { generatePresignedUploadUrl } from "../utils/storage";

class ApprenticeshipController {
  
  // 1. Create (Admin Only)
  static create = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userPayload = req.user as { userId: number, role: string };
      
      // Strict Role Check
      if (userPayload.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admins only." });
      }

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

  // 2. Get List (Student View)
  // Returns open positions mixed with application status
  static getAll = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userPayload = req.user as { userId: number };
      // We pass userId to service to determine "has_applied" status for UI
      const list = await ApprenticeshipService.getAllApprenticeships(userPayload.userId);
      return res.status(200).json(list);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // 3. Get Single Detail
  static getOne = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await ApprenticeshipService.getApprenticeshipById(Number(id));
      return res.status(200).json(item);
    } catch (error) {
      if (error instanceof ApiError) return res.status(error.statusCode).json({ message: error.message });
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // 4. Apply (Student Only)
  static apply = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userPayload = req.user as { userId: number };
      const { apprenticeship_id, resume_id, message } = req.body;

      // CHANGED: Validate resume_id
      if (!apprenticeship_id || !resume_id) {
        throw new BadRequestError("Apprenticeship ID and Resume ID are required");
      }

      const application = await ApprenticeshipService.applyForApprenticeship(
        userPayload.userId,
        { 
          apprenticeship_id: Number(apprenticeship_id), 
          resume_id: Number(resume_id), 
          message 
        }
      );

      return res.status(201).json({
        message: "Application submitted successfully",
        applicationId: application.application_id,
      });

    } catch (error) {
      if (error instanceof ApiError) return res.status(error.statusCode).json({ message: error.message });
      console.error(error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // 5. Get All Applications (Admin Only)
  static getAdminApplications = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userPayload = req.user as { role: string };
        if (userPayload.role !== 'admin') {
            return res.status(403).json({ message: "Access denied. Admins only." });
        }

        const data = await ApprenticeshipService.getAllApplications();
        return res.status(200).json(data);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  static getUploadUrl = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userPayload = req.user as { role: string };
      if (userPayload.role !== 'admin') {
        return res.status(403).json({ message: "Admins only." });
      }

      const { fileName, fileType } = req.body;
      if (!fileName || !fileType) {
        throw new BadRequestError("File name and type required");
      }

      // Save to 'jobs' folder
      const data = await generatePresignedUploadUrl(fileName, fileType, 'jobs');
      return res.status(200).json(data);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Could not generate upload URL" });
    }
  };
}

export default ApprenticeshipController;