import jwt from "jsonwebtoken"
const JWT_SECRET = process.env.JWT_SECRET

export const verifyToken = (token:string)=>{
    try {
        return jwt.verify(token,JWT_SECRET!)
    } catch (error) {
        throw new Error('invalid token')
    }
}