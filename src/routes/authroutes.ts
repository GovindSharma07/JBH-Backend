import { Router } from "express";
import AuthController from "../controllers/authcontroller";
import AuthMiddleware from "../middlewares/authMiddleware";
const router = Router();

router.post("/auth/register", AuthController.signup);
router.post("/auth/login",AuthController.login);
router.get("/user/:id",AuthMiddleware.authenticate, AuthController.getUserById)


export default router;

