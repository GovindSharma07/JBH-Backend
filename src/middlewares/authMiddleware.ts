import { Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { AuthenticatedRequest } from "../utils/types"; // Fixed typo
import redisClient from "../utils/redisClient";

class AuthMiddleware {
  static authenticate = async (
    req: AuthenticatedRequest, // Fixed typo
    res: Response,
    next: NextFunction
  ) => {
    // Add space after Bearer
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        message: "No Token Provided",
      });
    }
    try {
      // 1. Verify Signature (CPU operation, very fast)
      const decode = verifyToken(token) as { userId: number; role: string };

      // 2. NEW: Check Redis Cache (Fast I/O)
      const sessionKey = `session:${decode.userId}`;
      const cachedSession = await redisClient.get(sessionKey);

      if (!cachedSession) {
        // EDGE CASE: Token is valid but Redis key expired or missing (e.g. server restart)
        // Option A (Strict): Deny access (User must login again) -> Recommended for security
        return res.status(401).json({ message: "Session expired. Please login again." });

        // Option B (Fail-safe): Fallback to Database check, then re-cache (Cache-Aside)
        // See "Optimization" below if you want this.
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

export default AuthMiddleware;