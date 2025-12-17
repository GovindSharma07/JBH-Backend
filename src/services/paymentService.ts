import Razorpay from "razorpay";
import crypto from "crypto";
import { PrismaClient } from "../generated/prisma/client";
import { BadRequestError } from "../utils/errors";

const prisma = new PrismaClient();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

class PaymentService {
  
  // 1. Create a Razorpay Order
  static async createOrder(userId: number, courseId: number) {
    // A. Fetch Course Price
    const course = await prisma.courses.findUnique({
      where: { course_id: courseId }
    });
    
    if (!course) throw new BadRequestError("Course not found");
    if (Number(course.price) === 0) throw new BadRequestError("Course is free. Use enroll endpoint.");

    // B. Check if already enrolled
    const existing = await prisma.enrollments.findUnique({
      where: { user_id_course_id: { user_id: userId, course_id: courseId } }
    });
    if (existing) throw new BadRequestError("Already enrolled in this course.");

    // C. Create Razorpay Order
    // Amount must be in SMALLEST currency unit (Paise for INR). 
    // Example: 100 INR = 10000 paise.
    const amountInPaise = Number(course.price) * 100;

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_order_${new Date().getTime()}`,
      notes: {
        userId: userId.toString(),
        courseId: courseId.toString()
      }
    };

    try {
      const order = await razorpay.orders.create(options);

      // D. Log the "Pending" payment in our database
      await prisma.payments.create({
        data: {
          user_id: userId,
          course_id: courseId,
          amount: course.price,
          status: 'pending',
          payment_gateway_id: order.id, // Store the Rzp Order ID
        }
      });

      return order; // Send this to Frontend
    } catch (error) {
      console.error("Razorpay Error:", error);
      throw new Error("Failed to create payment order");
    }
  }

  // 2. Verify Payment Signature
  static verifyPaymentSignature(
    razorpayOrderId: string, 
    razorpayPaymentId: string, 
    razorpaySignature: string
  ) {
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    
    // Create HMAC SHA256 signature
    const generated_signature = crypto
      .createHmac("sha256", secret)
      .update(razorpayOrderId + "|" + razorpayPaymentId)
      .digest("hex");

    return generated_signature === razorpaySignature;
  }

  // Add this method inside your PaymentService class
static async handlePaymentSuccess(userId: number, courseId: number, orderId: string) {
  // Use a Transaction to ensure both happen or neither happens
  return await prisma.$transaction(async (tx) => {
    
    // 1. Update Payment Status
    // We search by order_id (which you stored as payment_gateway_id)
    const payment = await tx.payments.findFirst({
      where: { payment_gateway_id: orderId }
    });

    if (payment) {
      await tx.payments.update({
        where: { payment_id: payment.payment_id },
        data: { status: 'success' }
      });
    }

    // 2. Enroll User (Idempotent: Checks existence first to avoid errors on retry)
    const existingEnrollment = await tx.enrollments.findUnique({
      where: { user_id_course_id: { user_id: userId, course_id: courseId } }
    });

    if (!existingEnrollment) {
      await tx.enrollments.create({
        data: {
          user_id: userId,
          course_id: courseId,
          completion_status: 'in_progress'
        }
      });
    }
  });
}
}

export default PaymentService;