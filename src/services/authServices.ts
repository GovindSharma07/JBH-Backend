import bcrypt from "bcryptjs";
import { PrismaClient, users, VerificationTokenPurpose } from "../generated/prisma/client";
import jwt from "jsonwebtoken";
import { generateSecureToken, generateNumericCode } from "../utils/token";
import EmailService from "./emailService";
import SmsService from "./smsService";
import {
  InvalidCredentialsError,
  EmailNotVerifiedError,
  PhoneNotVerifiedError,
  UserNotFoundError,
  TokenExpiredError,
  BadRequestError,
} from "../utils/errors";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

class AuthService {
  static registerUser = async (
    full_name: string,
    email: string,
    password: string,
    phone: string
  ): Promise<users> => {
    const hashedPassword = await bcrypt.hash(password, 10);
    const emailOtpCode = generateNumericCode(6); 
    const tokenExpires = new Date(Date.now() + 600000); // 10 mins

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          full_name,
          email,
          password_hash: hashedPassword,
          phone,
          is_email_verified: false,
          is_phone_verified: false,
        },
      });

      await tx.verification_tokens.create({
        data: {
          user_id: user.user_id,
          token: emailOtpCode,
          expires_at: tokenExpires,
          purpose: VerificationTokenPurpose.EMAIL_VERIFICATION,
        },
      });
      return user;
    });

    EmailService.sendVerificationEmail(email, emailOtpCode).catch(console.error);
    SmsService.sendVerificationOtp(phone).catch(console.error); 
    return newUser;
  };

  static resendVerificationOtps = async (email: string) => {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) return; // Fail silently if user not found for security

    // 1. Resend Email OTP if not verified
    if (!user.is_email_verified) {
        const emailOtpCode = generateNumericCode(6);
        const tokenExpires = new Date(Date.now() + 600000);
        
        await prisma.verification_tokens.create({
            data: {
                user_id: user.user_id,
                token: emailOtpCode,
                expires_at: tokenExpires,
                purpose: VerificationTokenPurpose.EMAIL_VERIFICATION,
            }
        });
        // We await this to ensure it sends, but catch errors so we don't crash the request
        await EmailService.sendVerificationEmail(email, emailOtpCode).catch(console.error);
    }

    // 2. Resend SMS OTP if not verified
    if (!user.is_phone_verified) {
        await SmsService.sendVerificationOtp(user.phone).catch(console.error);
    }
  };

  static verifyEmail = async (email: string, code: string) => {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) throw new UserNotFoundError("User not found");
    
    // Success if already verified (Idempotency)
    if (user.is_email_verified) return true;

    // FIX: Find ANY valid token that matches the code, not just the latest one
    const verificationToken = await prisma.verification_tokens.findFirst({
      where: { 
          user_id: user.user_id, 
          token: code, // Match the code provided
          purpose: VerificationTokenPurpose.EMAIL_VERIFICATION,
          expires_at: { gt: new Date() } // Must not be expired
      }
    });

    if (!verificationToken) {
      throw new InvalidCredentialsError("Invalid or expired verification code.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { user_id: user.user_id },
        data: { is_email_verified: true },
      });
      // Cleanup tokens
      await tx.verification_tokens.deleteMany({
        where: { user_id: user.user_id, purpose: VerificationTokenPurpose.EMAIL_VERIFICATION },
      });
    });
    return true;
  };
  
  static verifyPhone = async (email: string, code: string): Promise<boolean> => {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) throw new UserNotFoundError("User not found");
    
    // Success if already verified (Idempotency)
    if (user.is_phone_verified) return true;

    const isCodeValid = await SmsService.checkVerificationOtp(user.phone, code);
    if (!isCodeValid) throw new InvalidCredentialsError("Invalid OTP code.");

    await prisma.users.update({
      where: { user_id: user.user_id },
      data: { is_phone_verified: true },
    });
    return true;
  };

  static loginUser = async (email: string, password: string) => {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) throw new InvalidCredentialsError("Invalid email or password");

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) throw new InvalidCredentialsError("Invalid email or password");

    // Check both flags
    if (!user.is_email_verified || !user.is_phone_verified) {
      throw new EmailNotVerifiedError("Account not verified"); 
    }

    const token = jwt.sign(
      { userId: user.user_id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    return token;
  };

  static requestPasswordReset = async (email: string) => {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) return; 

    const resetOtp = generateNumericCode(6);
    const expires = new Date(Date.now() + 600000);

    await prisma.verification_tokens.create({
      data: {
        user_id: user.user_id,
        token: resetOtp,
        expires_at: expires,
        purpose: VerificationTokenPurpose.PASSWORD_RESET, 
      },
    });
    await EmailService.sendVerificationEmail(email, resetOtp); 
  };

  static resetPassword = async (email: string, otp: string, newPassword: string) => {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) throw new UserNotFoundError("User not found");

    const resetToken = await prisma.verification_tokens.findFirst({
        where: { 
            user_id: user.user_id,
            token: otp, 
            purpose: VerificationTokenPurpose.PASSWORD_RESET,
            expires_at: { gt: new Date() }
        }
    });

    if (!resetToken) {
        throw new TokenExpiredError("Invalid or expired reset code.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
        await tx.users.update({
            where: { user_id: user.user_id },
            data: { password_hash: hashedPassword }
        });
        await tx.verification_tokens.deleteMany({
            where: { user_id: user.user_id, purpose: VerificationTokenPurpose.PASSWORD_RESET }
        });
    });
    return true;
  };

  static findUserByEmail = async (email: string) => {
    return prisma.users.findUnique({ where: { email } });
  };
  
  static findUserById = async (user_id: number) => {
    return prisma.users.findUnique({
      where: { user_id },
      select: { 
        user_id: true,
        full_name: true,
        email: true,
        role: true,
        is_email_verified: true,
        is_phone_verified: true
      }
    });
  };
}
export default AuthService;