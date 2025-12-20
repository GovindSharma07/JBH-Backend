import AuthService from "../services/authServices";
import { Request, Response } from "express";
import { AuthenticatedRequest } from "../utils/types";
import {
  validateEmail,
  validatePassword,
  validatePhone,
} from "../utils/validation";
import {
  AppError,
  BadRequestError,
  EmailNotVerifiedError,
  PhoneNotVerifiedError
} from "../utils/errors";
import redisClient from "../utils/redisClient";

class AuthController {
static signup = async (req: Request, res: Response) => {
    try {
      const { full_name, email, password, phone } = req.body;
      if (!validateEmail(email)) return res.status(400).json({ message: "Invalid email format." });
      if (!validatePassword(password)) return res.status(400).json({ message: "Password weak." });
      if (!validatePhone(phone)) return res.status(400).json({ message: "Invalid phone." });

      const existingUser = await AuthService.findUserByEmail(email);
      if (existingUser) return res.status(400).json({ message: "User already exists" });

      const newUser = await AuthService.registerUser(full_name, email, password, phone);
      const { password_hash, ...userResponse } = newUser;
      return res.status(201).json({
        message: "User registered. Please verify.",
        user: userResponse,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  static login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try { 
      const data = await AuthService.loginUser(email, password);
      return res.status(200).json({ message: "Login successful", token: data[0], user: data[1]   });
    } catch (error) {
      // --- UPDATED LOGIC ---
      if (error instanceof EmailNotVerifiedError || error instanceof PhoneNotVerifiedError) {
        // 1. Trigger resend
        await AuthService.resendVerificationOtps(email);
        
        // 2. Fetch user to know specifically WHICH one is missing
        const user = await AuthService.findUserByEmail(email);

        return res.status(403).json({ 
            message: "Account not verified. Codes resent.", 
            needsVerification: true,
            email: email,
            // Send status flags to frontend
            isEmailVerified: user?.is_email_verified ?? false,
            isPhoneVerified: user?.is_phone_verified ?? false
        });
      }
      // ---------------------

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  static resendOtp = async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) throw new BadRequestError("Email is required.");
      await AuthService.resendVerificationOtps(email);
      return res.status(200).json({ message: "Codes resent." });
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  static verifyEmail = async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) throw new BadRequestError("Email and code required.");
      await AuthService.verifyEmail(email, code);
      return res.status(200).json({ message: "Email verified." });
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  static verifyPhone = async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) throw new BadRequestError("Email and code required.");
      await AuthService.verifyPhone(email, code);
      return res.status(200).json({ message: "Phone verified." });
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  static forgotPassword = async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) throw new BadRequestError("Email is required.");
      await AuthService.requestPasswordReset(email);
      return res.status(200).json({ message: "OTP sent if account exists." });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  static resetPassword = async (req: Request, res: Response) => {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) throw new BadRequestError("All fields required.");
      if (!validatePassword(newPassword)) throw new BadRequestError("Password weak.");
      await AuthService.resetPassword(email, otp, newPassword);
      return res.status(200).json({ message: "Password reset successful." });
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  static getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jwtPayload = req.user as { userId: number };
    const cacheKey = `user:profile:${jwtPayload.userId}`;

    // 1. Check Redis
    const cachedUser = await redisClient.get(cacheKey);
    if (cachedUser) {
      return res.status(200).json(JSON.parse(cachedUser));
    }

    // 2. Fetch from DB
    const user = await AuthService.findUserById(jwtPayload.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 3. Cache it (e.g., for 10 minutes)
    await redisClient.setEx(cacheKey, 600, JSON.stringify(user));

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Internal server Error" });
  }
};
}
export default AuthController;