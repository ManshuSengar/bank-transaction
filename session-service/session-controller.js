const express = require("express");
const sessionRouter = express.Router();
const sessionDao = require("./session-dao");
const Logger = require("../logger/logger");
const log = new Logger("Session-Controller");
const { authenticateToken, authorize } = require("../middleware/auth-token-validator");

// Get all sessions with pagination and filters
sessionRouter.get(
  "/", 
  authenticateToken,
//   authorize(["view_sessions", "manage_users"]),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      
      const filters = {
        username: req.query.username,
        isActive: req.query.isActive === 'true' ? true : 
                 req.query.isActive === 'false' ? false : undefined,
        dateRange: {
          start: req.query.startDate,
          end: req.query.endDate
        }
      };

      const result = await sessionDao.getUserSessions(page, limit, filters);
      return res.send(result);
    } catch (err) {
      log.error(`Error retrieving sessions: ${err}`);
      return res.status(err.statusCode || 500).send({
        messageCode: err.messageCode || "INTERNAL_ERROR",
        message: err.userMessage || "An error occurred while retrieving sessions",
        error: err.message
      });
    }
  }
);

// Terminate a session
sessionRouter.post(
  "/:sessionId/terminate",
  authenticateToken,
//   authorize(["manage_sessions", "manage_users"]),
  async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) {
        return res.status(400).send({
          messageCode: "INVALID_ID",
          message: "Invalid session ID provided"
        });
      }

      const result = await sessionDao.terminateSession(sessionId);
      return res.send(result);
    } catch (err) {
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