// // email-service.js
// const nodemailer = require('nodemailer');
// const config = require('config');
// const Logger = require('../logger/logger');
// const log = new Logger('Email-Service');

// class EmailController {
//     constructor() {
//         this.transporter = nodemailer.createTransport({
//             host: config.get('email-config.host'),
//             port: config.get('email-config.port'),
//             secure: config.get('email-config.secure'),
//             auth: {
//                 user: config.get('email-config.user'),
//                 pass: config.get('email-config.password')
//             }
//         });
//     }

//     async sendWelcomeEmail(user, password) {
//         try {
//             const mailOptions = {
//                 from: config.get('email-config.from'),
//                 to: user.emailId,
//                 subject: 'Welcome to Fonexpay - Account Details',
//                 html: `
//                     <h1>Welcome to Fonexpay!</h1>
//                     <p>Dear ${user.firstname} ${user.lastname},</p>
//                     <p>Your account has been successfully created. Here are your login credentials:</p>
//                     <p><strong>Username:</strong> ${user.username}</p>
//                     <p><strong>Temporary Password:</strong> ${password}</p>
//                     <p>For security reasons, please change your password after your first login.</p>
//                     <p>If you have any questions, please don't hesitate to contact our support team.</p>
//                     <p>Best regards,<br>Fonexpay Team</p>
//                 `
//             };

//             await this.transporter.sendMail(mailOptions);
//             log.info(`Welcome email sent to ${user.emailId}`);
//         } catch (error) {
//             log.error('Error sending welcome email:', error);
//             throw error;
//         }
//     }

//     async sendPasswordResetEmail(user, resetToken) {
//         try {
//             const resetLink = `${config.get('app-config.frontendUrl')}/reset-password?token=${resetToken}`;

//             const mailOptions = {
//                 from: config.get('email-config.from'),
//                 to: user.emailId,
//                 subject: 'Password Reset Request',
//                 html: `
//                     <h1>Password Reset Request</h1>
//                     <p>Dear ${user.firstname} ${user.lastname},</p>
//                     <p>We received a request to reset your password. Click the link below to set a new password:</p>
//                     <p><a href="${resetLink}">Reset Password</a></p>
//                     <p>This link will expire in 1 hour.</p>
//                     <p>If you didn't request this, please ignore this email or contact our support team.</p>
//                     <p>Best regards,<br>Fonexpay Team</p>
//                 `
//             };

//             await this.transporter.sendMail(mailOptions);
//             log.info(`Password reset email sent to ${user.emailId}`);
//         } catch (error) {
//             log.error('Error sending password reset email:', error);
//             throw error;
//         }
//     }
// }

// module.exports = new EmailController();

const nodemailer = require("nodemailer");
const Logger = require("../logger/logger");
const log = new Logger("Email-Service");
const crypto = require("crypto");
const { eq, and, like, sql } = require("drizzle-orm");
const { db, users } = require("../user-service/db/schema");
class EmailController {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      // Create a test account with Ethereal
      const testAccount = await nodemailer.createTestAccount();

      // Create reusable transporter using the test account
      this.transporter = nodemailer.createTransport({
        host: "smtpout.secureserver.net",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
      log.info("Email transporter initialized with Ethereal account");
    } catch (error) {
      log.error("Error initializing email transporter:", error);
      throw error;
    }
  }

  async sendWelcomeEmail(user, temporaryPassword) {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      // Generate password reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry for first-time setup

      // Update user with reset token
      await db
        .update(users)
        .set({
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Create password setup link
      const setupPasswordLink = `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/auth/setup-password?token=${resetToken}`;

      const mailOptions = {
        from: '"Fonexpay" <Support@fonexpay.com>',
        to: user.emailId,
        subject: "Welcome to Fonexpay - Account Setup",
        html: `
                    <h1>Welcome to Fonexpay!</h1>
                    <p>Dear ${user.firstname} ${user.lastname},</p>
                    <p>Your account has been successfully created. Here are your account details:</p>
                    <p><strong>Username:</strong> ${user.username}</p>
                    <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
                    
                    <p>For security reasons, please set up your own password by clicking the link below:</p>
                    <p><a href="${setupPasswordLink}" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Set Up Your Password</a></p>
                    <p>This setup link will expire in 24 hours.</p>
                    
                    <p><strong>You can either:</strong></p>
                    <ul>
                        <li>Use the temporary password to log in and change your password later, or</li>
                        <li>Click the link above to set your password right away</li>
                    </ul>
                    
                    <p>If you have any questions, please don't hesitate to contact our support team.</p>
                    <p>Best regards,<br>Fonexpay Team</p>
                    
                    <p style="color: #666; font-size: 12px;">If you didn't create this account, please ignore this email or contact support.</p>
                `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      log.info(`Welcome email sent to ${user.emailId}`);

      return {
        messageId: info.messageId,
        resetToken,
      };
    } catch (error) {
      log.error("Error sending welcome email:", error);
      throw error;
    }
  }

  async sendPasswordResetEmail(user, resetToken) {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;

      const emailTemplate = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    .email-container {
                        font-family: Arial, sans-serif;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .button {
                        background-color: #4CAF50;
                        border: none;
                        color: white;
                        padding: 15px 32px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 16px;
                        margin: 4px 2px;
                        cursor: pointer;
                        border-radius: 4px;
                    }
                    .footer {
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        font-size: 12px;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <h1>Password Reset Request</h1>
                    <p>Dear ${user.firstname} ${user.lastname},</p>
                    <p>We received a request to reset your password for your Fonexpay account.</p>
                    <p>To reset your password, click the button below:</p>
                    <p>
                        <a href="${resetLink}" class="button" style="color: white;">
                            Reset Password
                        </a>
                    </p>
                    <p><strong>Important:</strong> This link will expire in 1 hour for security reasons.</p>
                    <p>If you didn't request this password reset, please ignore this email or contact our support team immediately.</p>
                    <div class="footer">
                        <p>Best regards,<br>Fonexpay Team</p>
                        <p>This is an automated message, please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

      const mailOptions = {
        from:
          process.env.SMTP_FROM || '"Fonexpay Support" <support@fonexpay.com>',
        to: user.emailId,
        subject: "Password Reset Request - Fonexpay",
        html: emailTemplate,
      };

      const info = await this.transporter.sendMail(mailOptions);

      log.info(
        `Password reset email sent to ${user.emailId}. MessageId: ${info.messageId}`
      );

      // For development environment, log preview URL
    //   if (process.env.NODE_ENV !== "production") {
    //     log.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    //   }

      // Update user record with reset token
      await db
        .update(users)
        .set({
          passwordResetToken: resetToken,
          passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      return {
        success: true,
        messageId: info.messageId,
        previewUrl:
          process.env.NODE_ENV !== "production"
            ? nodemailer.getTestMessageUrl(info)
            : null,
      };
    } catch (error) {
      log.error("Error sending password reset email:", error);
      throw new Error("Failed to send password reset email");
    }
  }
}

module.exports = new EmailController();
