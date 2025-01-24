// callback-service/callback-process-controller.js
const express = require("express");
const callbackProcessRouter = express.Router();
const callbackProcessDao = require("./callback-process-dao");
const Logger = require("../logger/logger");
const log = new Logger("Callback-Process-Controller");
const Joi = require("joi");
const { authenticateToken } = require("../middleware/auth-token-validator");

// Validation schema
const callbackSchema = Joi.object({
  data: Joi.string().required(), // Encrypted payload
});

// Callback Processing Endpoint
callbackProcessRouter.post("/bizzpaa", express.text(), async (req, res) => {
  try {
    let data = req.body;
    if (!data) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: "Request body is required",
      });
    }
    log.info(`Received callback data: ${data}`);
    data = data.trim();
    if (!data) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: "Request body cannot be empty",
      });
    }
    try {
      // Log system callback
      const { systemLog, decryptedData } =
        await callbackProcessDao.logSystemCallback(data);

      // Validate decrypted data
      if (!decryptedData) {
        return res.status(400).send({
          messageCode: "VALIDATION_ERROR",
          message: "Failed to decrypt data",
        });
      }

      const userCallback = await callbackProcessDao.processUserCallback(
        decryptedData
      );

      // Return success response
      return res.status(200).send({
        messageCode: "CALLBACK_PROCESSED",
        message: "Callback processed successfully",
        systemLogId: systemLog.id,
        userCallbackLogId: userCallback?.id,
      });
    } catch (error) {
      console.log("processError final--> ", error);
      log.error("Error processing callback:", error);
      throw {
        statusCode: 500,
        messageCode: "ERR_CALLBACK_PROCESS",
        message: error.message || "Error processing callback data",
      };
    }
  } catch (error) {
    console.log("processError 211final--> ", error);
    log.error("Callback error:", error);
    return res.status(error.statusCode || 500).send({
      messageCode: error.messageCode || "ERR_CALLBACK_PROCESS",
      message: error.message || "An unexpected error occurred",
    });
  }
});

callbackProcessRouter.get("/system-logs", async (req, res) => {
  try {
    const {
      userId,
      startDate,
      endDate,
      status,
      search,
      searchType = "all",
      limit = 50,
      offset = 0,
    } = req.query;

    // Initialize filters object
    const filters = {
      limit: Math.min(parseInt(limit) || 50, 100),
      offset: parseInt(offset) || 0,
    };

    // Add optional filters only if they exist and are valid
    if (userId) {
      const userIdNum = parseInt(userId);
      if (!isNaN(userIdNum)) {
        filters.userId = userIdNum;
      }
    }

    if (startDate && Date.parse(startDate)) {
      filters.startDate = new Date(startDate);
    }

    if (endDate && Date.parse(endDate)) {
      filters.endDate = new Date(endDate);
    }

    if (status) {
      filters.status = status.toUpperCase();
    }

    // Add search parameters only if search is not empty
    if (search && search.trim()) {
      filters.search = search.trim();
      filters.searchType = ["all", "transactionId", "orderId"].includes(
        searchType
      )
        ? searchType
        : "all";
    }

    const systemLogs = await callbackProcessDao.getFilteredSystemCallbackLogs(
      filters
    );

    res.send({
      messageCode: "SYSTEM_LOGS_RETRIEVED",
      message: "System callback logs retrieved successfully",
      data: systemLogs.logs,
      pagination: {
        total: systemLogs.total,
        limit: filters.limit,
        offset: filters.offset,
        page: Math.floor(filters.offset / filters.limit) + 1,
      },
    });
  } catch (error) {
    console.error("Error retrieving filtered system callback logs:", error);
    log.error("Error retrieving filtered system callback logs:", error);
    res.status(error.statusCode || 500).send({
      messageCode: error.messageCode || "ERR_FETCH_SYSTEM_LOGS",
      message: error.message || "Error retrieving system callback logs",
    });
  }
});

callbackProcessRouter.get('/user-logs', authenticateToken, async (req, res) => {
    try {
        const {
            startDate,
            endDate,
            limit = 50,
            offset = 0
        } = req.query;

        // Initialize filters object with validated parameters
        const filters = {
            userId: req.user.userId,
            limit: Math.min(parseInt(limit) || 50, 100), // Max 100 records
            offset: parseInt(offset) || 0
        };
        
        // Add optional date filters
        if (startDate && Date.parse(startDate)) {
            filters.startDate = new Date(startDate);
        }

        if (endDate && Date.parse(endDate)) {
            filters.endDate = new Date(endDate);
        }

        const userLogs = await callbackProcessDao.getFilteredUserCallbackLogs(filters);
        
        res.send({
            messageCode: 'USER_LOGS_RETRIEVED',
            message: 'User callback logs retrieved successfully',
            data: userLogs.logs,
            pagination: {
                total: userLogs.total,
                limit: filters.limit,
                offset: filters.offset,
                pages: Math.ceil(userLogs.total / filters.limit)
            }
        });

    } catch (error) {
        log.error('Error retrieving filtered user callback logs:', error);
        res.status(error.statusCode || 500).send({
            messageCode: error.messageCode || 'ERR_FETCH_USER_LOGS',
            message: error.message || 'Error retrieving user callback logs'
        });
    }
});

module.exports = callbackProcessRouter;
