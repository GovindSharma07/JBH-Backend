import { Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { AuthenticatedRequest } from "../utils/types"; // Fixed typo

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
      const decode = verifyToken(token);
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