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

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Schema for validating token creation requests
 * - name: Required string between 3-100 characters
 * - description: Optional string
 * - ipAddresses: Required array of valid IP addresses (at least one)
 */
const tokenRequestSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string(),
  ipAddresses: Joi.array().items(Joi.string().ip()).min(1).required(),
});

/**
 * Schema for validating token update requests
 * - name: Optional string between 3-100 characters
 * - description: Optional string
 * - ipAddresses: Optional array of valid IP addresses
 * - status: Optional string with specific allowed values
 * - rejectionReason: Required only when status is "REJECTED"
 */
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

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * POST /api/tokens
 * Request a new API token
 * Requires authentication
 */
apiTokenRouter.post("/", authenticateToken, async (req, res) => {
  try {
    // Validate request body
    const { error } = tokenRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: error.details[0].message,
      });
    }

    // Create token in database
    const token = await apiTokenDao.createToken({
      ...req.body,
      userId: req.user.userId,
      ipAddresses: req.body.ipAddresses.join(","), // Convert array to string for storage
    });

    // Return success response (without actual token until approved)
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

/**
 * PUT /api/tokens/:id
 * Update a token (admin only)
 * Requires authentication and authorization (commented out)
 */
apiTokenRouter.put(
  "/:id",
  authenticateToken,
  // authorize(['manage_tokens']), // Uncomment when authorization is implemented
  async (req, res) => {
    try {
      // Validate request body
      const { error } = tokenUpdateSchema.validate(req.body);
      if (error) {
        return res.status(400).send({
          messageCode: "VALIDATION_ERROR",
          message: error.details[0].message,
        });
      }

      // Prepare update data
      const updateData = {
        ...req.body,
        ipAddresses: req.body.ipAddresses?.join(","), // Convert array to string if provided
        approvedBy: req.user.userId,
        approvedAt: new Date(),
      };

      // Update token in database
      const token = await apiTokenDao.updateToken(req.params.id, updateData);

      // Check if token exists
      if (!token) {
        return res.status(404).send({
          messageCode: "TOKEN_NOT_FOUND",
          message: "API token not found",
        });
      }

      // Return success response
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

/**
 * GET /api/tokens
 * Get all tokens (admin only)
 * Requires authentication and authorization (commented out)
 * Supports pagination and filtering
 */
apiTokenRouter.get(
  "/",
  authenticateToken,
  // authorize(['manage_tokens']), // Uncomment when authorization is implemented
  async (req, res) => {
    try {
      // Parse query parameters
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const { status, search } = req.query;

      // Fetch tokens from database
      const tokens = await apiTokenDao.getTokens({
        page,
        limit,
        status: status || null,
        search: search || null,
      });

      // Return success response
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

/**
 * GET /api/tokens/my-tokens
 * Get current user's tokens
 * Requires authentication
 */
apiTokenRouter.get("/my-tokens", authenticateToken, async (req, res) => {
  try {
    // Fetch user's tokens from database
    const tokens = await apiTokenDao.getUserTokens(req.user.userId);
    
    // Return success response (only include token value if status is ACTIVE)
    res.send({
      messageCode: "TOKENS_FETCHED",
      message: "API tokens retrieved successfully",
      tokens: tokens.map((token) => ({
        ...token,
        token: token.status === "ACTIVE" ? token.token : undefined,
      })),
    });
  } catch (error) {
    log.error("Error getting user tokens:", error);
    res.status(500).send({
      messageCode: "ERR_GET_USER_TOKENS",
      message: "Error retrieving user tokens",
    });
  }
});

/**
 * GET /api/tokens/:id
 * Get token details by ID
 * Requires authentication
 * Users can only view their own tokens unless they have admin permissions
 */
apiTokenRouter.get("/:id", authenticateToken, async (req, res) => {
  try {
    // Fetch token from database
    const token = await apiTokenDao.getTokenById(req.params.id);

    // Check if token exists
    if (!token) {
      return res.status(404).send({
        messageCode: "TOKEN_NOT_FOUND",
        message: "API token not found",
      });
    }

    // Authorization check
    if (
      token.userId !== req.user.userId &&
      !req.user.permissions.includes("manage_tokens")
    ) {
      return res.status(403).send({
        messageCode: "FORBIDDEN",
        message: "Access denied",
      });
    }

    // Return success response (only include token value if status is ACTIVE and user owns the token)
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

/**
 * GET /api/tokens/:id/logs
 * Get token usage logs
 * Requires authentication
 * Users can only view their own token logs unless they have admin permissions
 */
apiTokenRouter.get("/:id/logs", authenticateToken, async (req, res) => {
  try {
    // Fetch token from database
    const token = await apiTokenDao.getTokenById(req.params.id);

    // Check if token exists
    if (!token) {
      return res.status(404).send({
        messageCode: "TOKEN_NOT_FOUND",
        message: "API token not found",
      });
    }

    // Authorization check
    if (
      token.userId !== req.user.userId &&
      !req.user.permissions.includes("manage_tokens")
    ) {
      return res.status(403).send({
        messageCode: "FORBIDDEN",
        message: "Access denied",
      });
    }

    // Parse query parameters
    const { page = 1, limit = 10 } = req.query;
    
    // Fetch token logs from database
    const logs = await apiTokenDao.getTokenLogs(req.params.id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    // Return success response
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

/**
 * PUT /api/tokens/:id/status
 * Update token status (admin only)
 * Requires authentication and authorization (commented out)
 */
apiTokenRouter.put(
  "/:id/status",
  authenticateToken,
  // authorize(["manage_tokens"]), // Uncomment when authorization is implemented
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

      // Update token status in database
      const token = await apiTokenDao.updateTokenStatus(
        req.params.id,
        status,
        rejectionReason,
        req.user.userId
      );

      // Check if token exists
      if (!token) {
        return res.status(404).send({
          messageCode: "TOKEN_NOT_FOUND",
          message: "API token not found",
        });
      }

      // Return success response
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

// ============================================================================
// EXPORT ROUTER
// ============================================================================

module.exports = apiTokenRouter;
