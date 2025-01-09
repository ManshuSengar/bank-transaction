// password-controller.js
const express = require('express');
const passwordRouter = express.Router();
const { db, users } = require('../user-service/db/schema');
const { eq } = require('drizzle-orm');
const bcrypt = require('bcryptjs');
const Logger = require('../logger/logger');
const log = new Logger('Password-Controller');
const Joi = require('joi');
const crypto=require('crypto');
const emailService=require("../email-service/email-controller");
// Validation schemas
const setupPasswordSchema = Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
            'any.required': 'Password is required'
        }),
    confirmPassword: Joi.string()
        .valid(Joi.ref('newPassword'))
        .required()
        .messages({
            'any.only': 'Passwords must match',
            'any.required': 'Password confirmation is required'
        })
});

// Setup/Reset password endpoint (works for both welcome email and password reset)
passwordRouter.post('/setup', async (req, res) => {
    try {
        // Validate request body
        const { error } = setupPasswordSchema.validate(req.body);
        if (error) {
            return res.status(400).send({
                messageCode: 'VALIDATION_ERROR',
                message: error.details[0].message
            });
        }

        const { token, newPassword } = req.body;

        // Find user with valid reset token
        const [user] = await db
            .select()
            .from(users)
            .where(
                and(
                    eq(users.passwordResetToken, token),
                    sql`${users.passwordResetExpires} > NOW()`
                )
            )
            .limit(1);

        if (!user) {
            return res.status(400).send({
                messageCode: 'INVALID_TOKEN',
                message: 'Password reset token is invalid or has expired'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user's password and clear reset token
        await db
            .update(users)
            .set({
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
                updatedAt: new Date()
            })
            .where(eq(users.id, user.id));

        // Log the password change
        await db
            .insert(userActivityLogs)
            .values({
                userId: user.id,
                activityType: 'PASSWORD_CHANGE',
                description: 'Password changed using reset token',
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

        return res.send({
            messageCode: 'PASSWORD_UPDATED',
            message: 'Your password has been successfully updated. You can now login with your new password.'
        });

    } catch (error) {
        log.error('Error in password setup:', error);
        return res.status(500).send({
            messageCode: 'INTERNAL_ERROR',
            message: 'An error occurred while setting up the password'
        });
    }
});

// Request password reset (when user forgets password)
passwordRouter.post('/request-reset', async (req, res) => {
    try {
        const { emailId } = req.body;

        if (!emailId) {
            return res.status(400).send({
                messageCode: 'VALIDATION_ERROR',
                message: 'Email address is required'
            });
        }

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.emailId, emailId))
            .limit(1);

        if (!user) {
            // For security, don't reveal whether email exists
            return res.send({
                messageCode: 'RESET_EMAIL_SENT',
                message: 'If an account exists with this email, you will receive password reset instructions.'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000); // 1 hour

        // Update user with reset token
        await db
            .update(users)
            .set({
                passwordResetToken: resetToken,
                passwordResetExpires: resetExpires,
                updatedAt: new Date()
            })
            .where(eq(users.id, user.id));

        // Send reset email
        await emailService.sendPasswordResetEmail(user, resetToken);

        return res.send({
            messageCode: 'RESET_EMAIL_SENT',
            message: 'Password reset instructions have been sent to your email'
        });

    } catch (error) {
        console.log("error",error)
        log.error('Error in request password reset:', error);
        return res.status(500).send({
            messageCode: 'INTERNAL_ERROR',
            message: 'An error occurred while processing your request'
        });
    }
});

// Verify reset token (optional - to verify token before showing password reset form)
passwordRouter.get('/verify-token/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const [user] = await db
            .select()
            .from(users)
            .where(
                and(
                    eq(users.passwordResetToken, token),
                    sql`${users.passwordResetExpires} > NOW()`
                )
            )
            .limit(1);

        if (!user) {
            return res.status(400).send({
                messageCode: 'INVALID_TOKEN',
                message: 'Password reset token is invalid or has expired'
            });
        }

        return res.send({
            messageCode: 'VALID_TOKEN',
            message: 'Token is valid'
        });

    } catch (error) {
        log.error('Error verifying reset token:', error);
        return res.status(500).send({
            messageCode: 'INTERNAL_ERROR',
            message: 'An error occurred while verifying the token'
        });
    }
});

module.exports = passwordRouter;