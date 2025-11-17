import jwt from "jsonwebtoken";

// Added a fallback secret for safety. 
// Your .env file should ALWAYS define JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || "your-fallback-secret-here";

export const verifyToken = (token: string) => {
  try {
    // Use the constant instead of process.env directly
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid token");
  }
};