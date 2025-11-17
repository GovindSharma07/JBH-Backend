import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/client";
import { users } from "../generated/prisma/client";
import jwt from "jsonwebtoken";
import { generateSecureToken } from "../utils/token";
import EmailService from "./emailService";
import SmsService from "./smsService";
import {
  InvalidCredentialsError,
  EmailNotVerifiedError,
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
    const emailToken = generateSecureToken();
    const tokenExpires = new Date(Date.now() + 3600000 * 24); // 24 hours

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
          token: emailToken,
          expires_at: tokenExpires,
          purpose: "EMAIL_VERIFICATION",
        },
      });
      return user;
    });

    EmailService.sendVerificationEmail(email, emailToken).catch(console.error);
    SmsService.sendVerificationOtp(phone).catch(console.error);
    return newUser;
  };

  static verifyPhone = async (email: string, code: string): Promise<boolean> => {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) throw new UserNotFoundError("User not found");
    if (user.is_phone_verified) {
        throw new BadRequestError("Phone is already verified");
    }

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

    if (!user.is_email_verified) {
      throw new EmailNotVerifiedError("Please verify your email before logging in.");
    }

    const token = jwt.sign(
      { userId: user.user_id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    return token;
  };

  static verifyEmail = async (token: string) => {
    const verificationToken = await prisma.verification_tokens.findUnique({
      where: { token: token, purpose: "EMAIL_VERIFICATION" },
    });
    if (!verificationToken || verificationToken.expires_at < new Date()) {
      throw new TokenExpiredError("Token is invalid or has expired.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { user_id: verificationToken.user_id },
        data: { is_email_verified: true },
      });
      await tx.verification_tokens.delete({
        where: { token_id: verificationToken.token_id },
      });
    });
    return true;
  };

  static requestPasswordReset = async (email: string) => {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) return; // No error for security

    const resetToken = generateSecureToken();
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await prisma.verification_tokens.create({
      data: {
        user_id: user.user_id,
        token: resetToken,
        expires_at: expires,
        purpose: "PASSWORD_RESET",
      },
    });
    await EmailService.sendPasswordResetEmail(email, resetToken);
  };

  static resetPassword = async (token: string, newPassword: string) => {
    const resetToken = await prisma.verification_tokens.findUnique({
        where: { token: token, purpose: "PASSWORD_RESET" }
    });
    if (!resetToken || resetToken.expires_at < new Date()) {
        throw new TokenExpiredError("Token is invalid or has expired.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
        await tx.users.update({
            where: { user_id: resetToken.user_id },
            data: { password_hash: hashedPassword }
        });
        await tx.verification_tokens.delete({
            where: { token_id: resetToken.token_id }
        });
    });
    return true;
  };

  static findUserByEmail = async (email: string) => {
    return prisma.users.findUnique({
      where: { email },
    });
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