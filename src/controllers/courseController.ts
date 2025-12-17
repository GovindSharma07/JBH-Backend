import { Response } from "express";
import { AuthenticatedRequest } from "../utils/types";
import CourseService from "../services/courseService";
import { BadRequestError } from "../utils/errors";
import EnrollmentService from "../services/enrollmentService";

class CourseController {
  
  // Public: Get all courses
 // Public: Get all courses
  static getList = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // 1. Get user from the request (guaranteed to exist now)
      const user = req.user as { role: string };
      const isAdmin = user.role === 'admin';

      const courses = await CourseService.getAllCourses(isAdmin);
      
      return res.status(200).json(courses);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Error fetching courses" });
    }
  };

  // Public/Protected: Get details
  static getDetail = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const course = await CourseService.getCourseById(Number(id));
      return res.status(200).json(course);
    } catch (error) {
      if (error instanceof BadRequestError) return res.status(404).json({ message: error.message });
      return res.status(500).json({ message: "Internal Error" });
    }
  };

  // Admin Only: Create Course
  static create = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { role: string };
      if (user.role !== 'admin') return res.status(403).json({ message: "Admins only" });

      const newCourse = await CourseService.createCourse(req.body);
      return res.status(201).json(newCourse);
    } catch (error) {
      return res.status(500).json({ message: "Failed to create course" });
    }
  };

  // Admin Only: Add Syllabus Module
  static addModule = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { role: string };
      if (user.role !== 'admin') return res.status(403).json({ message: "Admins only" });

      const { id } = req.params; // Course ID
      const { title, order } = req.body;

      const module = await CourseService.addModule(Number(id), title, order || 0);
      return res.status(201).json(module);
    } catch (error) {
      return res.status(500).json({ message: "Failed to add module" });
    }
  };

static getMyCourses = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // The authMiddleware populates req.user
      const user = req.user as { userId: number };

      // Call the service we created earlier
      const courses = await EnrollmentService.getMyCourses(user.userId);

      return res.status(200).json(courses);
    } catch (error) {
      console.error("Get My Courses Error:", error);
      return res.status(500).json({ message: "Failed to fetch enrolled courses" });
    }
  };

  // 2. ENROLL (Free / Manual)
  // This handles the free course enrollment logic
  static enroll = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { userId: number };
      const { id } = req.params; // Course ID from URL

      const result = await EnrollmentService.enrollUser(user.userId, Number(id));
      
      return res.status(200).json({ message: "Enrolled successfully", enrollment: result });
    } catch (error) {
      if (error instanceof BadRequestError) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Enrollment failed" });
    }
  };

  // Admin: Update Course
  static update = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { role: string };
      if (user.role !== 'admin') return res.status(403).json({ message: "Admins only" });

      const { id } = req.params;
      const updatedCourse = await CourseService.updateCourse(Number(id), req.body);
      return res.status(200).json(updatedCourse);
    } catch (error) {
      return res.status(500).json({ message: "Failed to update course" });
    }
  };

  // Admin: Delete Course
  static delete = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { role: string };
      if (user.role !== 'admin') return res.status(403).json({ message: "Admins only" });

      const { id } = req.params;
      await CourseService.deleteCourse(Number(id));
      return res.status(200).json({ message: "Course deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete course" });
    }
  };

  // Admin: Update Module
  static updateModule = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { role: string };
      if (user.role !== 'admin') return res.status(403).json({ message: "Admins only" });

      const { id } = req.params; // Module ID
      const { title, order } = req.body;

      const module = await CourseService.updateModule(Number(id), title, order);
      return res.status(200).json(module);
    } catch (error) {
      return res.status(500).json({ message: "Failed to update module" });
    }
  };

  // Admin: Delete Module
  static deleteModule = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { role: string };
      if (user.role !== 'admin') return res.status(403).json({ message: "Admins only" });

      const { id } = req.params; // Module ID
      await CourseService.deleteModule(Number(id));
      return res.status(200).json({ message: "Module deleted" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete module" });
    }
  };

  // Admin: Reorder Modules
  static reorderModules = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { role: string };
      if (user.role !== 'admin') return res.status(403).json({ message: "Admins only" });

      const { id } = req.params; // Course ID
      const { updates } = req.body; // Array of { id, order }

      await CourseService.reorderModules(Number(id), updates);
      return res.status(200).json({ message: "Modules reordered" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to reorder modules" });
    }
  };

  // NEW ENDPOINT: Toggle Publish Status
  // Usage: PATCH /courses/:id/publish
  // Body: { "is_published": true }
  static togglePublish = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { role: string };
      if (user.role !== 'admin') return res.status(403).json({ message: "Admins only" });

      const { id } = req.params;
      const { is_published } = req.body;

      if (typeof is_published !== 'boolean') {
        return res.status(400).json({ message: "is_published must be a boolean" });
      }

      const updatedCourse = await CourseService.togglePublishStatus(Number(id), is_published);
      return res.status(200).json({ 
        message: is_published ? "Course published" : "Course unpublished",
        course: updatedCourse 
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to update publish status" });
    }
  };
}

export default CourseController;