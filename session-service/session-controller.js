const express = require("express");
const sessionRouter = express.Router();
const sessionDao = require("./session-dao");
const Logger = require("../logger/logger");
const log = new Logger("Session-Controller");
const { authenticateToken, authorize } = require("../middleware/auth-token-validator");

/**
 * GET /sessions
 * Retrieves all user sessions with pagination and filtering options
 * Requires authentication token
 * Optional query parameters: page, limit, username, isActive, startDate, endDate
 */
sessionRouter.get(
  "/", 
  authenticateToken,
  // authorize(["view_sessions", "manage_users"]), // Uncomment and configure as needed
  async (req, res) => {
    try {
      // Parse pagination parameters with defaults
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      
      // Build filter object from query parameters
      const filters = {
        username: req.query.username,
        isActive: req.query.isActive === 'true' ? true : 
                 req.query.isActive === 'false' ? false : undefined,
        dateRange: {
          start: req.query.startDate,
          end: req.query.endDate
        }
      };

      // Retrieve sessions from data access layer
      const result = await sessionDao.getUserSessions(page, limit, filters);
      
      // Return successful response with session data
      return res.send(result);
    } catch (err) {
      // Log error and return appropriate error response
      log.error(`Error retrieving sessions: ${err}`);
      return res.status(err.statusCode || 500).send({
        messageCode: err.messageCode || "INTERNAL_ERROR",
        message: err.userMessage || "An error occurred while retrieving sessions",
        error: err.message
      });
    }
  }
);

/**
 * POST /sessions/:sessionId/terminate
 * Terminates a specific user session
 * Requires authentication token and valid session ID
 */
sessionRouter.post(
  "/:sessionId/terminate",
  authenticateToken,
  // authorize(["manage_sessions", "manage_users"]), // Uncomment and configure as needed
  async (req, res) => {
    try {
      // Parse and validate session ID parameter
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) {
        return res.status(400).send({
          messageCode: "INVALID_ID",
          message: "Invalid session ID provided"
        });
      }

      // Attempt to terminate the session
      const result = await sessionDao.terminateSession(sessionId);
      
      // Return success response
      return res.send(result);
    } catch (err) {
      // Log error and return appropriate error response
      log.error(`Error terminating session: ${err}`);
      return res.status(err.statusCode || 500).send({
        messageCode: err.messageCode || "INTERNAL_ERROR",
        message: err.userMessage || "An error occurred while terminating session",
        error: err.message
      });
    }
  }
);

module.exports = sessionRouter;
