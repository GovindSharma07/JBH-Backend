import { Response } from "express";
import { AuthenticatedRequest } from "../utils/types";
import ResumeService from "../services/resumeService";
import { generatePresignedUploadUrl } from "../utils/storage";
import { AppError, BadRequestError } from "../utils/errors";

class ResumeController {
  
  // Step 1: Frontend requests a URL to upload file to B2
  static getUploadUrl = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fileName, fileType } = req.body;
      
      if (!fileName || !fileType) {
        throw new BadRequestError("File name and type are required");
      }

      const data = await generatePresignedUploadUrl(fileName, fileType);
      return res.status(200).json(data);
    } catch (error) {
      console.error("Presigned URL Error:", error);
      return res.status(500).json({ message: "Could not generate upload URL" });
    }
  };

  // Step 2: Frontend confirms upload and saves metadata to DB
  static uploadResume = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userPayload = req.user as { userId: number };
      const { name, file_url } = req.body;

      if (!name || !file_url) {
        throw new BadRequestError("Resume name and file URL are required.");
      }

      const resume = await ResumeService.addResume(userPayload.userId, { name, file_url });
      
      return res.status(201).json({
        message: "Resume saved successfully",
        data: resume
      });
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  static getMyResumes = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userPayload = req.user as { userId: number };
      const resumes = await ResumeService.getUserResumes(userPayload.userId);
      return res.status(200).json(resumes);
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  static deleteResume = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userPayload = req.user as { userId: number };
      const { id } = req.params;
      
      await ResumeService.deleteResume(userPayload.userId, Number(id));
      
      return res.status(200).json({ message: "Resume deleted successfully" });
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };
}

export default ResumeController;