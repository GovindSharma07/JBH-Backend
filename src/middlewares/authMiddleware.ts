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

export default AuthMiddleware;