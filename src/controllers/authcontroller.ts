import AuthService from "../services/authServices";
import { Request, Response } from "express";
import { AuthenticatedRequest } from "../utils/types";
import {
  validateEmail,
  validatePassword,
  validatePhone,
} from "../utils/validation";
import {
  ApiError,
  BadRequestError,
} from "../utils/errors";

class AuthController {
  static signup = async (req: Request, res: Response) => {
    try {
      const { full_name, email, password, phone } = req.body;
      if (!validateEmail(email)) {
        return res.status(400).json({ message: "Invalid email format." });
      }
      if (!validatePassword(password)) {
        return res.status(400).json({ 
          message: "Password must be at least 8 characters long and include one uppercase, one lowercase, and one number." 
        });
      }
      if (!validatePhone(phone)) {
        return res.status(400).json({ message: "Invalid phone number format. Must be E.164 (e.g., +919876543210)." });
      }

      const e164Phone = `+91${phone}`;

      const existingUser = await AuthService.findUserByEmail(email);
      if (existingUser)
        return res.status(400).json({ message: "User already exists" });

      const newUser = await AuthService.registerUser(
        full_name, email, password, phone
      );

      const { password_hash, ...userResponse } = newUser;
      return res.status(201).json({
        message: "User registered. Please check your email and phone for verification.",
        user: userResponse,
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  static login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const token = await AuthService.loginUser(email, password);
      return res.status(200).json({ message: "Login successful", token: token });
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

static verifyEmail = async (req: Request, res: Response) => {
    try {
      // MODIFIED: Expecting email and code, not a single token
      const { email, code } = req.body;
      if (!email || !code) {
        throw new BadRequestError("Email and verification code are required.");
      }
      // Added basic check for 6-digit code consistency
      if (code.length !== 6 || isNaN(Number(code))) {
         throw new BadRequestError("Invalid code format. Expected 6 digits.");
      }

      await AuthService.verifyEmail(email as string, code as string);
      return res.status(200).json({ message: "Email verified successfully." });
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  static verifyPhone = async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        throw new BadRequestError("Email and code are required.");
      }
      await AuthService.verifyPhone(email, code);
      return res.status(200).json({ message: "Phone verified successfully." });
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  static forgotPassword = async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) throw new BadRequestError("Email is required.");
      await AuthService.requestPasswordReset(email);
      return res.status(200).json({ 
          message: "If an account with that email exists, a password reset link has been sent." 
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  static resetPassword = async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        throw new BadRequestError("Token and newPassword are required.");
      }
      if (!validatePassword(newPassword)) {
        throw new BadRequestError("Password does not meet requirements.");
      }
      await AuthService.resetPassword(token, newPassword);
      return res.status(200).json({ message: "Password has been reset successfully." });
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  static getMe = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jwtPayload = req.user as { userId: number };
      if (!jwtPayload || !jwtPayload.userId) {
          return res.status(401).json({ message: "Invalid user token" });
      }
      const user = await AuthService.findUserById(jwtPayload.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.status(200).json(user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server Error" });
    }
  };
}
export default AuthController;