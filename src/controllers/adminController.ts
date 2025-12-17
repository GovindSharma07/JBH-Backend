import { Response } from "express";
import { AuthenticatedRequest } from "../utils/types";
import { BadRequestError } from "../utils/errors";
import { AdminService } from "../services/adminService"; // Import the new service

class AdminController {
  
  // 1. Get All Users
  static getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Role check is best done in middleware, but if you keep it here:
      const userPayload = req.user as { role: string };
      if (userPayload.role !== 'admin') return res.status(403).json({ message: "Admins only." });

      const users = await AdminService.getAllUsers();
      return res.status(200).json(users);
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // 2. Create User
  static createUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const newUser = await AdminService.createUser(req.body);
      return res.status(201).json({ message: "User created successfully", userId: newUser.user_id });
    } catch (error) {
      if (error instanceof BadRequestError) return res.status(400).json({ message: error.message });
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // 3. Delete User
  static deleteUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      await AdminService.deleteUser(Number(id));
      return res.status(200).json({ message: "User deleted and logged out successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete user" });
    }
  };

  // 4. Block User (Placeholder)
  static blockUser = async (req: AuthenticatedRequest, res: Response) => {
    return res.status(501).json({ message: "Block feature requires schema update" });
  };

  // 5. Get Upload URL
  static getUploadUrl = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fileName, fileType, folder } = req.body;
      const data = await AdminService.getUploadUrl(fileName, fileType, folder);
      return res.status(200).json(data);
    } catch (error) {
      if (error instanceof BadRequestError) return res.status(400).json({ message: error.message });
      return res.status(500).json({ message: "Could not generate upload URL" });
    }
  };

  // 6. Create Timetable Slot
  static createScheduleSlot = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const newSlot = await AdminService.createScheduleSlot(req.body);
      return res.status(201).json({ success: true, message: "Schedule slot created.", slot: newSlot });
    } catch (error) {
      if (error instanceof BadRequestError) return res.status(400).json({ message: error.message });
      console.error("Create Schedule Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // 7. Delete Schedule Slot
  static deleteScheduleSlot = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      await AdminService.deleteScheduleSlot(Number(id));
      return res.status(200).json({ success: true, message: "Slot removed." });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete slot." });
    }
  };
}

export default AdminController;