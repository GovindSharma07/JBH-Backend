import { JwtPayload } from "jsonwebtoken";
import { Request } from "express";

export interface AuthneticatedReuest extends Request{
    user?: string| JwtPayload
}