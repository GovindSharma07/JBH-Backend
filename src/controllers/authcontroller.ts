import AuthService from "../services/authServices";
import { Request, Response } from "express";
import { AuthneticatedReuest } from "../utils/types";

class AuthController{
    static signup
     = async (req: Request, res: Response) => {
        try {
        const { full_name, email, password ,phone} = req.body;
        const existingUser = await AuthService.findUserByEmail(email);
        if(existingUser)
            return res.status(400).json({message: "User already exists"});
        
                const newUser = await AuthService.registerUser(full_name, email, password,phone);
                return res.status(201).json({ message: "User registered successfully", user: newUser });
            }catch (error) {
                return res.status(500).json({ message: "Internal server error" });
            }
    }

    static login = async (req: Request, res: Response) => {
        try {
            const { email, password } = req.body;
            const result = await AuthService.loginUser(email, password);
            if (!result) {
                return res.status(401).json({ message: "Invalid email or password" });
            }
            return res.status(200).json({ message: "Login successful",token: result });
     }
     catch(error){
        
     }
    }

    static getUserById = async(req:AuthneticatedReuest,res : Response)=>{
        try {
            const user = req.user;
        if(!user) res.status(400).json({
            message: "Access Denied"
        })
        const userId = req.params.id;
        const foundUser = await AuthService.findUserById(
            parseInt(userId!)
        );
        if(!foundUser) return res.status(400).json({
            message: "User not found with this id"
        })
        res.status(200).json(foundUser)
        } catch (error) {
            res.status(500).json({
                message:"Internal server Error"
            });
        }
    }
}
     export default AuthController;