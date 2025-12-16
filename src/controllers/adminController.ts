import { Response } from "express";
import { PrismaClient } from "../generated/prisma/client";
import { AuthenticatedRequest } from "../utils/types";
import { BadRequestError, UserNotFoundError } from "../utils/errors";
import bcrypt from "bcryptjs";
import redisClient from "../utils/redisClient";
import { validateEmail, validatePassword } from "../utils/validation";
import { generatePresignedUploadUrl } from "../utils/storage";

const prisma = new PrismaClient();

class AdminController {
  
  // 1. Get All Users
  static getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Security check (Double check role even if middleware does it)
      const userPayload = req.user as { role: string };
      if (userPayload.role !== 'admin') return res.status(403).json({ message: "Admins only." });

      const users = await prisma.users.findMany({
        select: {
          user_id: true,
          full_name: true,
          email: true,
          phone: true,
          role: true,
          is_email_verified: true,
          is_phone_verified: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' }
      });

      return res.status(200).json(users);
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // 2. Create New User (Admin/Instructor) manually
  static createUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { full_name, email, password, phone, role } = req.body;
      
      // Validate input
      if (!full_name || !email || !password || !phone || !role) {
        throw new BadRequestError("Email, password and role are required.");
      }

      // Check if user exists
      const existing = await prisma.users.findUnique({ where: { email } });
      if (existing) {
        throw new BadRequestError("User already exists.");
      }

      if (!validatePassword(password)) {
        throw new BadRequestError("Password weak. Must be 8+ chars with 1 upper, 1 lower, 1 number.");
      }

      if(!validateEmail(email)) {
        throw new BadRequestError("Invalid email format.");
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await prisma.users.create({
        data: {
          full_name,
          email,
          password_hash: hashedPassword,
          phone,
          role: role, // 'admin', 'instructor', 'student'
          is_email_verified: true, // Auto-verify manually created accounts
          is_phone_verified: true 
        }
      });

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
    
    // 1. Delete from Database
    await prisma.users.delete({ where: { user_id: Number(id) } });

    // 2. NEW: Immediately invalidate session in Redis
    await redisClient.del(`session:${id}`);

    return res.status(200).json({ message: "User deleted and logged out successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete user" });
  }
};

  // 4. Block User (Toggle role to 'blocked' or similar logic if schema supports it)
  // For now, we can just change password to a random string to lockout, 
  // or if you update schema to have is_active, use that. 
  // Let's assume we just don't have a 'blocked' state yet, so we skip or implement a basic lockout.
  static blockUser = async (req: AuthenticatedRequest, res: Response) => {
      // Placeholder: In a real app, add 'is_active' to your Prisma schema
      return res.status(501).json({ message: "Block feature requires schema update (add is_active field)" });
  };

  static getUploadUrl = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fileName, fileType, folder } = req.body;
      
      if (!fileName || !fileType) {
        throw new BadRequestError("File name and type are required");
      }

      // 1. Security: Whitelist allowed folders
      const allowedFolders = ['courses', 'lessons', 'resumes', 'avatars'];
      let targetFolder = folder || 'courses';

      if (!allowedFolders.includes(targetFolder)) {
        return res.status(400).json({ message: "Invalid upload folder" });
      }

      // 2. Generate URL
      const data = await generatePresignedUploadUrl(fileName, fileType, targetFolder);
      return res.status(200).json(data);
    } catch (error) {
      console.error("Upload URL Error:", error);
      return res.status(500).json({ message: "Could not generate upload URL" });
    }
  };
}

export default AdminController;