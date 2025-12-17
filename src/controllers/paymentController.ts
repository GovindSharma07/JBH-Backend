import { Response } from "express";
import { AuthenticatedRequest } from "../utils/types";
import PaymentService from "../services/paymentService";
import { BadRequestError } from "../utils/errors";

class PaymentController {

  // Step 1: Create Order
  static createOrder = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { userId: number };
      const { courseId } = req.body;

      if (!courseId) throw new BadRequestError("Course ID is required");

      const order = await PaymentService.createOrder(user.userId, Number(courseId));
      
      return res.status(200).json({
        keyId: process.env.RAZORPAY_KEY_ID,
        order: order
      });
    } catch (error) {
      // Handle specific errors gracefully
      if (error instanceof BadRequestError) return res.status(400).json({ message: error.message });
      
      console.error("Create Order Error:", error);
      return res.status(500).json({ message: "Failed to create order" });
    }
  };

  // Step 2: Verify & Enroll
  static verifyPayment = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user as { userId: number };
      const { 
        razorpayOrderId, 
        razorpayPaymentId, 
        razorpaySignature,
        courseId 
      } = req.body;

      // 1. Validate Input
      if(!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !courseId) {
         return res.status(400).json({ message: "Missing payment details" });
      }

      // 2. Verify Signature
      const isValid = PaymentService.verifyPaymentSignature(
        razorpayOrderId, 
        razorpayPaymentId, 
        razorpaySignature
      );

      if (!isValid) {
        return res.status(400).json({ message: "Invalid Payment Signature" });
      }

      // 3. Process Transaction (Update DB + Enroll)
      // We assume PaymentService now contains the 'handlePaymentSuccess' method added above
      await PaymentService.handlePaymentSuccess(
        user.userId, 
        Number(courseId), 
        razorpayOrderId
      );

      return res.status(200).json({ message: "Payment Verified & Enrolled" });

    } catch (error) {
      console.error("Payment Verification Error:", error);
      return res.status(500).json({ message: "Verification failed. Please contact support if money was deducted." });
    }
  };
}

export default PaymentController;