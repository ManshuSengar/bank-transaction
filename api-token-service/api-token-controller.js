const express = require("express");
const apiTokenRouter = express.Router();
const apiTokenDao = require("./api-token-dao");
const Logger = require("../logger/logger");
const log = new Logger("API-Token-Controller");
const {
  authenticateToken,
  authorize,
} = require("../middleware/auth-token-validator");
const Joi = require("joi");

// Validation schemas
const tokenRequestSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string(),
  ipAddresses: Joi.array().items(Joi.string().ip()).min(1).required(),
});

const tokenUpdateSchema = Joi.object({
  name: Joi.string().min(3).max(100),
  description: Joi.string(),
  ipAddresses: Joi.array().items(Joi.string().ip()),
  status: Joi.string().valid("ACTIVE", "INACTIVE", "REJECTED"),
  rejectionReason: Joi.string().when("status", {
    is: "REJECTED",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

// Request new API token
apiTokenRouter.post("/", authenticateToken, async (req, res) => {
  try {
    const { error } = tokenRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: error.details[0].message,
      });
    }

    const token = await apiTokenDao.createToken({
      ...req.body,
      userId: req.user.userId,
      ipAddresses: req.body.ipAddresses.join(","),
    });

    res.status(201).send({
      messageCode: "TOKEN_REQUESTED",
      message: "API token request submitted successfully",
      token: {
        ...token,
        token: undefined, // Don't send the actual token until approved
      },
    });
  } catch (error) {
    log.error("Error requesting API token:", error);
    res.status(500).send({
      messageCode: "ERR_TOKEN_REQUEST",
      message: "Error requesting API token",
    });
  }
});

// Update token (admin only)
apiTokenRouter.put(
  "/:id",
  authenticateToken,
  // authorize(['manage_tokens']),
  async (req, res) => {
    try {
      const { error } = tokenUpdateSchema.validate(req.body);
      if (error) {
        return res.status(400).send({
          messageCode: "VALIDATION_ERROR",
          message: error.details[0].message,
        });
      }

      const updateData = {
        ...req.body,
        ipAddresses: req.body.ipAddresses?.join(","),
        approvedBy: req.user.userId,
        approvedAt: new Date(),
      };

      const token = await apiTokenDao.updateToken(req.params.id, updateData);

      if (!token) {
        return res.status(404).send({
          messageCode: "TOKEN_NOT_FOUND",
          message: "API token not found",
        });
      }

      res.send({
        messageCode: "TOKEN_UPDATED",
        message: "API token updated successfully",
        token:
          token.status === "ACTIVE" ? token : { ...token, token: undefined },
      });
    } catch (error) {
      log.error("Error updating API token:", error);
      res.status(500).send({
        messageCode: "ERR_TOKEN_UPDATE",
        message: "Error updating API token",
      });
    }
  }
);

// Get all tokens (admin)
apiTokenRouter.get(
  "/",
  authenticateToken,
  // authorize(['manage_tokens']),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const { status, search } = req.query;

      const tokens = await apiTokenDao.getTokens({
        page,
        limit,
        status: status || null,
        search: search || null,
      });

      res.send({
        messageCode: "TOKENS_FETCHED",
        message: "API tokens retrieved successfully",
        ...tokens,
      });
    } catch (error) {
      console.log("Error getting API tokens:", error);
      log.error("Error getting API tokens:", error);
      res.status(500).send({
        messageCode: "ERR_GET_TOKENS",
        message: "Error retrieving API tokens",
      });
    }
  }
);

// Get user's tokens
apiTokenRouter.get("/my-tokens", authenticateToken, async (req, res) => {
  try {
    const tokens = await apiTokenDao.getUserTokens(req.user.userId);
    res.send({
        messageCode: 'TOKENS_FETCHED',
        message: 'API tokens retrieved successfully',
        tokens: tokens.map(token => ({
            ...token,
            // Only include token value if status is ACTIVE
            token: token.status === 'ACTIVE' ? token.token : undefined
        }))
    });
  } catch (error) {
    log.error("Error getting user tokens:", error);
    res.status(500).send({
      messageCode: "ERR_GET_USER_TOKENS",
      message: "Error retrieving user tokens",
    });
  }
});

// Get token details
apiTokenRouter.get("/:id", authenticateToken, async (req, res) => {
  try {
    const token = await apiTokenDao.getTokenById(req.params.id);

    if (!token) {
      return res.status(404).send({
        messageCode: "TOKEN_NOT_FOUND",
        message: "API token not found",
      });
    }

    // Only allow users to view their own tokens unless they have admin permission
    if (
      token.userId !== req.user.userId &&
      !req.user.permissions.includes("manage_tokens")
    ) {
      return res.status(403).send({
        messageCode: "FORBIDDEN",
        message: "Access denied",
      });
    }

    res.send({
      messageCode: "TOKEN_FETCHED",
      message: "API token retrieved successfully",
      token:
        token.status === "ACTIVE" && token.userId === req.user.userId
          ? token
          : { ...token, token: undefined },
    });
  } catch (error) {
    log.error("Error getting API token:", error);
    res.status(500).send({
      messageCode: "ERR_GET_TOKEN",
      message: "Error retrieving API token",
    });
  }
});

// Get token usage logs
apiTokenRouter.get("/:id/logs", authenticateToken, async (req, res) => {
  try {
    const token = await apiTokenDao.getTokenById(req.params.id);

    if (!token) {
      return res.status(404).send({
        messageCode: "TOKEN_NOT_FOUND",
        message: "API token not found",
      });
    }

    // Only allow users to view their own token logs unless they have admin permission
    if (
      token.userId !== req.user.userId &&
      !req.user.permissions.includes("manage_tokens")
    ) {
      return res.status(403).send({
        messageCode: "FORBIDDEN",
        message: "Access denied",
      });
    }

    const { page = 1, limit = 10 } = req.query;
    const logs = await apiTokenDao.getTokenLogs(req.params.id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.send({
      messageCode: "LOGS_FETCHED",
      message: "Token usage logs retrieved successfully",
      ...logs,
    });
  } catch (error) {
    log.error("Error getting token logs:", error);
    res.status(500).send({
      messageCode: "ERR_GET_LOGS",
      message: "Error retrieving token logs",
    });
  }
});

apiTokenRouter.put(
  "/:id/status",
  authenticateToken,
//   authorize(["manage_tokens"]),
  async (req, res) => {
    try {
      const { status, rejectionReason } = req.body;

      // Validate status
      if (!["ACTIVE", "INACTIVE", "REJECTED"].includes(status)) {
        return res.status(400).send({
          messageCode: "INVALID_STATUS",
          message: "Invalid status value",
        });
      }

      // Require rejection reason when status is REJECTED
      if (status === "REJECTED" && !rejectionReason) {
        return res.status(400).send({
          messageCode: "REJECTION_REASON_REQUIRED",
          message: "Rejection reason is required when rejecting a token",
        });
      }

      const token = await apiTokenDao.updateTokenStatus(
        req.params.id,
        status,
        rejectionReason,
        req.user.userId
      );

      if (!token) {
        return res.status(404).send({
          messageCode: "TOKEN_NOT_FOUND",
          message: "API token not found",
        });
      }

      res.send({
        messageCode: "STATUS_UPDATED",
        message: "Token status updated successfully",
        token:
          token.status === "ACTIVE" ? token : { ...token, token: undefined },
      });
    } catch (error) {
      log.error("Error updating token status:", error);
      res.status(500).send({
        messageCode: "ERR_UPDATE_STATUS",
        message: "Error updating token status",
      });
    }
  }
);
module.exports = apiTokenRouter;
