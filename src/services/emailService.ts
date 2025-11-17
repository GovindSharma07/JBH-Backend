import sgMail from '@sendgrid/mail';

// Set the API key from your .env file
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn("SENDGRID_API_KEY not set. Emails will not be sent.");
}

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@jbh-academy.com";

class EmailService {
  static async sendVerificationEmail(to: string, token: string) {
    const verificationUrl = `http://your-frontend-app.com/verify-email?token=${token}`;
    
    const msg = {
      to: to,
      from: FROM_EMAIL, // Use your verified sender
      subject: "JBH Tech Academy: Verify Your Email",
      html: `
        <h1>Welcome to JBH Tech Academy!</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
      `,
    };

    try {
      if (process.env.SENDGRID_API_KEY) {
        await sgMail.send(msg);
        console.log(`Verification email sent to ${to}`);
      } else {
        console.log(`SIMULATE: Verification email sent to ${to} (URL: ${verificationUrl})`);
      }
    } catch (error) {
      console.error("Error sending verification email:", error);
    }
  }

  static async sendPasswordResetEmail(to: string, token: string) {
    const resetUrl = `http://your-frontend-app.com/reset-password?token=${token}`;

    const msg = {
      to: to,
      from: FROM_EMAIL,
      subject: "JBH Tech Academy: Password Reset Request",
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Please click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
      `,
    };

    try {
      if (process.env.SENDGRID_API_KEY) {
        await sgMail.send(msg);
        console.log(`Password reset email sent to ${to}`);
      } else {
        console.log(`SIMULATE: Password reset email sent to ${to} (URL: ${resetUrl})`);
      }
    } catch (error) {
      console.error("Error sending password reset email:", error);
    }
  }
}

export default EmailService;