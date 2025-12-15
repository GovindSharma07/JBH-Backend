import { Router } from "express";
import AuthMiddleware from "../middlewares/authMiddleware";
import PaymentController from "../controllers/paymentController";

const router = Router();

router.post("/payments/create-order", AuthMiddleware.authenticate, PaymentController.createOrder);
router.post("/payments/verify", AuthMiddleware.authenticate, PaymentController.verifyPayment);

export default router;