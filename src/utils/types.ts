import { Request } from "express";
import { JwtPayload } from "jsonwebtoken";

// We remove 'string' because your middleware always decodes it to an object
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    role: string;
    email?: string;
    [key: string]: any;
  } & JwtPayload; 
}