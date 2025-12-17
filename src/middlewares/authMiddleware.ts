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
      return res.status(401).json({
        message: "No Token Provided",
      });
    }
    try {
      // 1. Verify Signature
      const decode = verifyToken(token) as { userId: number; role: string };

      // 2. Check Redis Cache
      const sessionKey = `session:${decode.userId}`;
      const cachedSession = await redisClient.get(sessionKey);

      if (!cachedSession) {
        return res.status(401).json({ message: "Session expired. Please login again." });
      }

      // 3. Attach User to Request
      req.user = decode;
      next();
    } catch (error) {
      res.status(401).json({
        message: "Invalid Token",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}

// --- EXPORTS FOR LMS ROUTES ---

// 1. Export 'authenticateUser' (Alias for existing logic)
export const authenticateUser = AuthMiddleware.authenticate;

// 2. Export 'authorizeRoles' (Fixed Type Casting)
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // 1. Safety Check: Ensure user exists
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // 2. Explicitly Cast User to the expected type
    // This tells TypeScript: "Trust me, req.user has a role property"
    const user = req.user as { userId: number; role: string };

    // 3. Check Role
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ 
        message: "Forbidden: You do not have permission to access this resource" 
      });
    }

    next();
  };
};

export default AuthMiddleware;