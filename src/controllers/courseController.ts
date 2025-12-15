import { Response } from "express";
import { AuthenticatedRequest } from "../utils/types";
import CourseService from "../services/courseService";
import { BadRequestError } from "../utils/errors";
import EnrollmentService from "../services/enrollmentService";

class CourseController {
  
  // Public: Get all courses
  static getList = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const courses = await CourseService.getAllCourses();
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
      // Strict Role Check
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

  // Student: Enroll (Free/Manual)
  static enroll = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { userId: number };
      const { id } = req.params; // Course ID

      const enrollment = await EnrollmentService.enrollUser(user.userId, Number(id));
      return res.status(201).json({ message: "Enrolled successfully", data: enrollment });
    } catch (error) {
      if (error instanceof BadRequestError) return res.status(400).json({ message: error.message });
      return res.status(500).json({ message: "Enrollment failed" });
    }
  };
  
  // Student: Get My Courses
  static getMyCourses = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { userId: number };
      const courses = await EnrollmentService.getMyCourses(user.userId);
      return res.status(200).json(courses);
    } catch (error) {
      return res.status(500).json({ message: "Error fetching your courses" });
    }
  };
}

export default CourseController;