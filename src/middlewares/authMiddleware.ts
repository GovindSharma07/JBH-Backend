import { Request,Response,NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { AuthneticatedReuest } from "../utils/types";

class AuthMiddleware{
    static authenticate = async(req:AuthneticatedReuest,res:Response,next : NextFunction)=>{
        const token = req.header("Authorization")?.replace(
            "Bearer",""
        );

        if(!token) return res.status(401).json({
            message:"No Token Provided"
        })
        try {
            const decode = verifyToken(token);
            req.user = decode
            next()
        } catch (error) {
            res.status(401).json({
                message: "Invalid Token",error
            })
        }
    }
}

export default AuthMiddleware;