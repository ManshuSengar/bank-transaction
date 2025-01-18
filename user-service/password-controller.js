// password-controller.js
const express = require("express");
const passwordRouter = express.Router();
const { db, users } = require("../user-service/db/schema");
const { eq, and, sql } = require("drizzle-orm");
const bcrypt = require("bcryptjs");
const Logger = require("../logger/logger");
const log = new Logger("Password-Controller");
const Joi = require("joi");
const crypto = require("crypto");
const emailService = require("../email-service/email-controller");
const setupPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    )
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character",
      "any.required": "Password is required",
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Passwords must match",
      "any.required": "Password confirmation is required",
    }),
});

passwordRouter.post("/setup", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Add debug logging
    console.log("Attempting password reset with token:", token);

    // First, let's fetch the user and log the expiry time
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.passwordResetToken, token))
      .limit(1);

    if (!user) {
      console.log("No user found with token:", token);
      return res.status(400).send({
        messageCode: "INVALID_TOKEN",
        message: "Password reset token is invalid",
      });
    }

    // Log the expiry time and current time for debugging
    console.log("Reset token expires:", user.passwordResetExpires);
    console.log("Current server time:", new Date());

    // Check if token has expired
    const now = new Date();
    const expires = new Date(user.passwordResetExpires);

    if (now > expires) {
      console.log("Token expired. Current time:", now, "Expiry time:", expires);
      return res.status(400).send({
        messageCode: "EXPIRED_TOKEN",
        message: "Password reset token has expired",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db
      .update(users)
      .set({
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return res.send({
      messageCode: "PASSWORD_UPDATED",
      message: "Your password has been successfully updated",
    });
  } catch (error) {
    console.log("Error in password setup:", error);
    log.error("Error in password setup:", error);
    return res.status(500).send({
      messageCode: "INTERNAL_ERROR",
      message: "An error occurred while setting up the password",
    });
  }
});

passwordRouter.post("/request-reset", async (req, res) => {
  try {
    const { emailId } = req.body;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.emailId, emailId))
      .limit(1);

    if (!user) {
      return res.send({
        messageCode: "RESET_EMAIL_SENT",
        message:
          "If an account exists with this email, you will receive password reset instructions.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    // Set expiry to exactly 1 hour from now using ISO string
    const resetExpires = new Date(Date.now() + 3600000);

    console.log("Creating reset token:", {
      token: resetToken,
      expires: resetExpires,
      currentTime: new Date().toISOString(),
    });

    await db
      .update(users)
      .set({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await emailService.sendPasswordResetEmail(user, resetToken);

    return res.send({
      messageCode: "RESET_EMAIL_SENT",
      message: "Password reset instructions have been sent to your email",
    });
  } catch (error) {
    console.log("Error in request reset:", error);
    log.error("Error in request password reset:", error);
    return res.status(500).send({
      messageCode: "INTERNAL_ERROR",
      message: "An error occurred while processing your request",
    });
  }
});
passwordRouter.get("/verify-token/:token", async (req, res) => {
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
        messageCode: "INVALID_TOKEN",
        message:
          "Password reset link has expired or is invalid. Please request a new link.",
      });
    }

    return res.send({
      messageCode: "VALID_TOKEN",
      message: "Token is valid",
    });
  } catch (error) {
    log.error("Error verifying reset token:", error);
    return res.status(500).send({
      messageCode: "INTERNAL_ERROR",
      message: "An error occurred while verifying the token",
    });
  }
});

module.exports = passwordRouter;
