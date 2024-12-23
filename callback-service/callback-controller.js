const express = require("express");
const callbackRouter = express.Router();
const callbackDao = require("./callback-dao");
const encryptionService = require("../encryption-service/encryption-dao");
const {
  callbackConfigSchema,
  callbackRequestSchema,
} = require("./callback-schema-model");
const {
  authenticateToken,
  authorize,
} = require("../middleware/auth-token-validator");
const Logger = require("../logger/logger");
const log = new Logger("Callback-Controller");

// Create callback configuration
callbackRouter.post("/config", authenticateToken, async (req, res) => {
  try {
    const { error } = callbackConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: error.details[0].message,
      });
    }

    const config = await callbackDao.createCallbackConfig({
      ...req.body,
      userId: req.user.userId,
    });

    res.status(201).send({
      messageCode: "CALLBACK_CONFIG_CREATED",
      message: "Callback configuration created successfully",
      config,
    });
  } catch (error) {
    console.log("error--> ",error);
    log.error("Error creating callback config:", error);
    res.status(500).send({
      messageCode: "ERR_CREATE_CALLBACK_CONFIG",
      message: "Error creating callback configuration",
    });
  }
});

// Update callback configuration
callbackRouter.put("/config/:id", authenticateToken, async (req, res) => {
  try {
    const { error } = callbackConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: error.details[0].message,
      });
    }       

    const config = await callbackDao.updateCallbackConfig(
      req.params.id,
      req.body
    );

    if (!config) {
      return res.status(404).send({
        messageCode: "CALLBACK_CONFIG_NOT_FOUND",
        message: "Callback configuration not found",
      });
    }

    res.send({
      messageCode: "CALLBACK_CONFIG_UPDATED",
      message: "Callback configuration updated successfully",
      config,
    });
  } catch (error) {
    log.error("Error updating callback config:", error);
    res.status(500).send({
      messageCode: "ERR_UPDATE_CALLBACK_CONFIG",
      message: "Error updating callback configuration",
    });
  }
});

// Get user's callback configurations
callbackRouter.get("/config", authenticateToken, async (req, res) => {
  try {
    const configs = await callbackDao.getUserCallbackConfigs(req.user.userId);

    res.send({
      messageCode: "CALLBACK_CONFIGS_FETCHED",
      message: "Callback configurations retrieved successfully",
      configs,
    });
  } catch (error) {
    log.error("Error getting callback configs:", error);
    res.status(500).send({
      messageCode: "ERR_GET_CALLBACK_CONFIGS",
      message: "Error retrieving callback configurations",
    });
  }
});
callbackRouter.post("/process", authenticateToken, async (req, res) => {
  try {
    const { configId, requestData } = req.body;

    const config = await callbackDao.getCallbackConfigById(configId);
    if (!config || config.userId !== req.user.userId) {
      return res.status(403).send({
        messageCode: "UNAUTHORIZED_CALLBACK",
        message: "Unauthorized callback configuration",
      });
    }

    let decryptedData;
    try {
      decryptedData = await encryptionService.decrypt(requestData);
    } catch (decryptError) {
      await callbackDao.createCallbackLog({
        configId,
        originalRequestData: requestData,
        status: "FAILED",
        errorMessage: "Decryption failed",
      });

      return res.status(400).send({
        messageCode: "DECRYPTION_FAILED",
        message: "Failed to decrypt callback data",
      });
    }

    const responseData = {
      status: "SUCCESS",
      message: "Callback processed successfully",
    };

    let encryptedResponseData;
    try {
      encryptedResponseData = await encryptionService.encrypt(responseData);
    } catch (encryptError) {
      await callbackDao.createCallbackLog({
        configId,
        originalRequestData: requestData,
        decryptedData,
        status: "FAILED",
        errorMessage: "Response encryption failed",
      });

      return res.status(500).send({
        messageCode: "ENCRYPTION_FAILED",
        message: "Failed to encrypt response",
      });
    }

    await callbackDao.createCallbackLog({
      configId,
      originalRequestData: requestData,
      decryptedData,
      encryptedResponseData,
      status: "SUCCESS",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.send({
      messageCode: "CALLBACK_PROCESSED",
      message: "Callback processed successfully",
      responseData: encryptedResponseData,
    });
  } catch (error) {
    log.error("Error processing callback:", error);
    res.status(500).send({
      messageCode: "ERR_PROCESS_CALLBACK",
      message: "Error processing callback",
    });
  }
});

callbackRouter.get("/logs/:configId", authenticateToken, async (req, res) => {
  try {
    const { page, limit, status } = req.query;

    const config = await callbackDao.getCallbackConfigById(req.params.configId);
    if (!config || config.userId !== req.user.userId) {
      return res.status(403).send({
        messageCode: "UNAUTHORIZED_ACCESS",
        message: "You are not authorized to view these logs",
      });
    }

    const logs = await callbackDao.getCallbackLogs(req.params.configId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status: status || null,
    });

    res.send({
      messageCode: "CALLBACK_LOGS_FETCHED",
      message: "Callback logs retrieved successfully",
      ...logs,
    });
  } catch (error) {
    log.error("Error getting callback logs:", error);
    res.status(500).send({
      messageCode: "ERR_GET_CALLBACK_LOGS",
      message: "Error retrieving callback logs",
    });
  }
});

module.exports = callbackRouter;
