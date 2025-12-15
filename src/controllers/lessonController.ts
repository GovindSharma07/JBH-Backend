import { Response } from "express";
import { AuthenticatedRequest } from "../utils/types";
import LessonService from "../services/lessonService";
import { BadRequestError } from "../utils/errors";

class LessonController {
  
  // Admin: Add Lesson
  static create = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { role: string };
      if (user.role !== 'admin') return res.status(403).json({ message: "Admins only" });

      const { moduleId, title, contentUrl, contentType, duration, isFree } = req.body;
      
      if (!moduleId || !title || !contentUrl) {
        throw new BadRequestError("Module ID, Title, and Content URL are required");
      }

      const lesson = await LessonService.addLesson({
        moduleId: Number(moduleId),
        title,
        contentUrl,
        contentType: contentType || 'video',
        duration: duration ? Number(duration) : undefined,
        isFree
      });

      return res.status(201).json(lesson);
    } catch (error) {
      if (error instanceof BadRequestError) return res.status(400).json({ message: error.message });
      return res.status(500).json({ message: "Failed to add lesson" });
    }
  };

  // Student: View Lesson (Protected logic inside Service)
  static getOne = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { userId: number; role: string };
      const { id } = req.params;

      // Allow admins to bypass enrollment check logic if needed, 
      // but for now we let the service handle it.
      const lesson = await LessonService.getLessonById(user.userId, Number(id));
      return res.status(200).json(lesson);
    } catch (error) {
      if (error instanceof BadRequestError) return res.status(403).json({ message: error.message });
      return res.status(500).json({ message: "Error fetching lesson" });
    }
  };
}

export default LessonController;