import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/client";
import { users } from "../generated/prisma/client";
import jwt from "jsonwebtoken";


const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

class AuthService {
    static registerUser = async (
        full_name: string,
        email: string,
        password: string,
        phone:string
    ):Promise<users> => {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.users.create({
            data: {
                full_name,
                email,
                password_hash: hashedPassword,
                phone
            },
        });
        return newUser;
    }

    static findUserByEmail = async (email: string) => {
        const user = await prisma.users.findUnique({
            where: { email },
        });
        return user;
    }

    static loginUser = async (email: string, password: string) => {
        const user = await this.findUserByEmail(email);
        if (!user) {
            return null;
        }
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return null;
        }  
        const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: "1h" });
        return token;
    }

    static findUserById = async(user_id:number)=>{
        return prisma.users.findUnique({where: {
            user_id
        }})

    }
}

export default AuthService;