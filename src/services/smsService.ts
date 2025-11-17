import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

// Initialize Twilio client only if credentials are set
const twilioClient = accountSid && authToken 
  ? twilio(accountSid, authToken) 
  : null;

class SmsService {
  /**
   * Sends an OTP to the user's phone number using Twilio Verify.
   * @param phone - The phone number in E.164 format (e.g., "+919876543210")
   */
  static async sendVerificationOtp(phone: string): Promise<boolean> {
    if (!twilioClient || !verifyServiceSid) {
      console.warn("Twilio credentials not set. SMS (OTP) will not be sent.");
      console.log(`SIMULATE: OTP sent to ${phone}`);
      return true; // Simulate success in a dev environment
    }

    try {
      await twilioClient.verify.v2.services(verifyServiceSid)
        .verifications
        .create({ to: phone, channel: 'sms' });
      
      console.log(`Verification OTP sent to ${phone}`);
      return true;
    } catch (error) {
      console.error(`Error sending OTP to ${phone}:`, error);
      return false;
    }
  }

  /**
   * Checks if the provided OTP code is valid for the given phone number.
   * @param phone - The phone number in E.164 format (e.g., "+919876543210")
   * @param code - The 6-digit OTP code entered by the user
   */
  static async checkVerificationOtp(phone: string, code: string): Promise<boolean> {
    if (!twilioClient || !verifyServiceSid) {
      console.warn("Twilio credentials not set. Cannot check OTP.");
      // In a dev environment, you might want to bypass
      return code === "123456"; // Example bypass for testing
    }

    try {
      const check = await twilioClient.verify.v2.services(verifyServiceSid)
        .verificationChecks
        .create({ to: phone, code: code });

      // If the status is "approved", the code is correct.
      return check.status === "approved";
    } catch (error) {
      console.error(`Error checking OTP for ${phone}:`, error);
      return false;
    }
  }
}

export default SmsService;