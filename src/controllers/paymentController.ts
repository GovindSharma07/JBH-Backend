import { Response } from "express";
import { AuthenticatedRequest } from "../utils/types";
import PaymentService from "../services/paymentService";
import EnrollmentService from "../services/enrollmentService";
import { PrismaClient } from "../generated/prisma/client";
import { BadRequestError } from "../utils/errors";

const prisma = new PrismaClient();

class PaymentController {

  // Step 1: Frontend calls this to get an Order ID
  static createOrder = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { userId: number };
      const { courseId } = req.body;

      if (!courseId) throw new BadRequestError("Course ID is required");

      const order = await PaymentService.createOrder(user.userId, Number(courseId));
      
      // Return Key ID too so frontend doesn't need to hardcode it
      return res.status(200).json({
        keyId: process.env.RAZORPAY_KEY_ID,
        order: order
      });
    } catch (error) {
      if (error instanceof BadRequestError) return res.status(400).json({ message: error.message });
      console.error(error);
      return res.status(500).json({ message: "Failed to create order" });
    }
  };

  // Step 2: Frontend calls this AFTER Razorpay success
  static verifyPayment = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { userId: number };
      const { 
        razorpayOrderId, 
        razorpayPaymentId, 
        razorpaySignature,
        courseId 
      } = req.body;

      // 1. Verify Signature
      const isValid = PaymentService.verifyPaymentSignature(
        razorpayOrderId, 
        razorpayPaymentId, 
        razorpaySignature
      );

      if (!isValid) {
        return res.status(400).json({ message: "Invalid Payment Signature" });
      }

      // 2. Update Payment Status in DB
      const paymentRecord = await prisma.payments.findFirst({
        where: { payment_gateway_id: razorpayOrderId }
      });

      if (paymentRecord) {
        await prisma.payments.update({
          where: { payment_id: paymentRecord.payment_id },
          data: { status: 'success' }
        });
      }

      // 3. Enroll the User
      await EnrollmentService.enrollUser(user.userId, Number(courseId));

      return res.status(200).json({ message: "Payment Verified & Enrolled" });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Verification failed" });
    }
  };
}

export default PaymentController;