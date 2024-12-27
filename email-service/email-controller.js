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


const nodemailer = require('nodemailer');
const Logger = require('../logger/logger');
const log = new Logger('Email-Service');

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
                host: 'smtpout.secureserver.net',
                port: 465,
                secure: true, 
                auth: {
                    user: process.env.EMAIL,
                    pass: process.env.EMAIL_PASSWORD
                }
            });
            log.info('Email transporter initialized with Ethereal account');
         
        } catch (error) {
            log.error('Error initializing email transporter:', error);
            throw error;
        }
    }

    async sendWelcomeEmail(user, password) {
        try {
            if (!this.transporter) {
                await this.initializeTransporter();
            }

            const mailOptions = {
                from: '"Fonexpay" <Support@fonexpay.com>',
                to: user.emailId,
                subject: 'Welcome to Fonexpay - Account Details',
                html: `
                    <h1>Welcome to Fonexpay!</h1>
                    <p>Dear ${user.firstname} ${user.lastname},</p>
                    <p>Your account has been successfully created. Here are your login credentials:</p>
                    <p><strong>Username:</strong> ${user.username}</p>
                    <p><strong>Temporary Password:</strong> ${password}</p>
                    <p>For security reasons, please change your password after your first login.</p>
                    <p>If you have any questions, please don't hesitate to contact our support team.</p>
                    <p>Best regards,<br>Fonexpay Team</p>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            log.info(`Welcome email sent to ${user.emailId}`);
            log.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
            
            return {
                messageId: info.messageId,
                previewUrl: nodemailer.getTestMessageUrl(info)
            };
        } catch (error) {
            log.error('Error sending welcome email:', error);
            throw error;
        }
    }

    async sendPasswordResetEmail(user, resetToken) {
        try {
            if (!this.transporter) {
                await this.initializeTransporter();
            }

            const resetLink = `http://localhost:4200/reset-password?token=${resetToken}`;
            
            const mailOptions = {
                from: '"Fonexpay" <test@bankingapp.com>',
                to: user.emailId,
                subject: 'Password Reset Request',
                html: `
                    <h1>Password Reset Request</h1>
                    <p>Dear ${user.firstname} ${user.lastname},</p>
                    <p>We received a request to reset your password. Click the link below to set a new password:</p>
                    <p><a href="${resetLink}">Reset Password</a></p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request this, please ignore this email or contact our support team.</p>
                    <p>Best regards,<br>Fonexpay Team</p>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            log.info(`Password reset email sent to ${user.emailId}`);
            log.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
            
            return {
                messageId: info.messageId,
                previewUrl: nodemailer.getTestMessageUrl(info)
            };
        } catch (error) {
            log.error('Error sending password reset email:', error);
            throw error;
        }
    }
}

module.exports = new EmailController();