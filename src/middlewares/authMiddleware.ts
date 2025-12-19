// src/middlewares/authMiddleware.ts
import { Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { AuthenticatedRequest } from "../utils/types";
import redisClient from "../utils/redisClient";

class AuthMiddleware {
  static authenticate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "No Token Provided" });
    }
    try {
      const decode = verifyToken(token) as { userId: number; role: string };

      // FIX: Normalize role to lowercase immediately
      // This ensures 'Instructor', 'INSTRUCTOR', and 'instructor' are all treated as 'instructor'
      req.user = { 
        ...decode, 
        role: decode.role.toLowerCase() 
      };

      // Check Redis Cache
      const sessionKey = `session:${decode.userId}`;
      const cachedSession = await redisClient.get(sessionKey);

      if (!cachedSession) {
        return res.status(401).json({ message: "Session expired. Please login again." });
      }

      next();
    } catch (error) {
      res.status(401).json({
        message: "Invalid Token",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}

// ... (keep exports same as before)
export const authenticateUser = AuthMiddleware.authenticate;
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    // With the fix above, req.user.role is guaranteed to be lowercase now
    const user = req.user as { userId: number; role: string };

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ 
        message: "Forbidden: You do not have permission to access this resource" 
      });
    }
    next();
  };
};

export default AuthMiddleware;