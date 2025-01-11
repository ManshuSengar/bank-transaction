// payout-service/payout-controller.js
const express = require("express");
const payoutRouter = express.Router();
const payoutDao = require("./payout-dao");
const userDao = require("../user-service/user-dao");
const apiTokenDao = require("../api-token-service/api-token-dao");
const Logger = require("../logger/logger");
const log = new Logger("Payout-Controller");
const Joi = require("joi");
const uniqueIdDao = require("../unique-service/unique-id-dao");

// Validation Schemas
const accountValidateSchema = Joi.object({
  clientId: Joi.string().required(), // username
  secretKey: Joi.string().required(), // token
  number: Joi.string()
    .pattern(/^\d{10}$/)
    .required(),
  accountNo: Joi.string().pattern(/^\d+$/).required(),
  ifscCode: Joi.string()
    .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .required(),
  clientOrderId: Joi.string().required(),
});

const payoutSchema = Joi.object({
  // clientId: Joi.string().required(),     // username
  // secretKey: Joi.string().required(),    // token
  // number: Joi.string().pattern(/^\d{10}$/).required(),
  // amount: Joi.string().required(),
  // transferMode: Joi.string().valid('IMPS', 'NEFT', 'RTGS').required(),
  // accountNo: Joi.string().required(),
  // ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(),
  // beneficiaryName: Joi.string().required(),
  // clientOrderId: Joi.string().required()
});

const statusCheckSchema = Joi.object({
  clientId: Joi.string().required(), // username
  secretKey: Joi.string().required(), // token
  clientOrderId: Joi.string().required(),
});

// Account Validation Endpoint
payoutRouter.post("/account-validate", async (req, res) => {
  try {
    const { error } = accountValidateSchema.validate(req.body);
    if (error) {
      return res.status(400).send({
        statusCode: 0,
        message: error.details[0].message,
        clientOrderId: req.body.clientOrderId,
        orderId: null,
        beneficiaryName: null,
        utr: null,
        status: null,
      });
    }

    // Validate user and token
    const user = await userDao.getUserByUsername(req.body.clientId);
    if (!user) {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid username",
        clientOrderId: req.body.clientOrderId,
        orderId: null,
        beneficiaryName: null,
        utr: null,
        status: null,
      });
    }

    const apiToken = await apiTokenDao.getTokenByValue(req.body.secretKey);
    if (!apiToken || apiToken.status !== "ACTIVE") {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid token",
        clientOrderId: req.body.clientOrderId,
        orderId: null,
        beneficiaryName: null,
        utr: null,
        status: null,
      });
    }

    // Generate internal unique ID
    // const uniqueIdRecord = await uniqueIdDao.createUniqueIdRecord(
    //     user.id,
    //     req.body.clientOrderId,
    //     0  // amount is not needed for validation
    // );

    const result = await payoutDao.verifyAccount(
      user.id,
      {
        phoneNumber: req.body.number,
        accountNumber: req.body.accountNo,
        ifscCode: req.body.ifscCode,
        clientOrderId: uniqueIdRecord.clientOrderId,
        originalClientOrderId: req.body.clientOrderId,
        ipAddress: req.ip,
      },
      req.body.secretKey
    );

    res.send({
      statusCode: result.vendorResponse.success ? 1 : 0, // Directly use the success flag
      message: result.vendorResponse.message || null,
      clientOrderId: req.body.clientOrderId,
      orderId: result.vendorResponse.orderId || null,
      beneficiaryName: result.vendorResponse.success
        ? result.vendorResponse.beneficiaryName
        : null,
      utr: "NA",
      status: result.vendorResponse.success ? 1 : 0, // Vendor status code
    });
  } catch (error) {
    log.error("Error in account validation:", error);
    res.status(500).send({
      statusCode: 0,
      message: error.message || "Internal server error",
      clientOrderId: req.body.clientOrderId,
      orderId: null,
      beneficiaryName: null,
      utr: null,
      status: null,
    });
  }
});

payoutRouter.post("/payout", async (req, res) => {
  try {
    // const { error } = payoutSchema.validate(req.body);
    // if (error) {
    //     return res.status(400).send({
    //         statusCode: 0,
    //         message: error.details[0].message,
    //         clientOrderId: req.body.clientOrderId,
    //         orderId: null,
    //         beneficiaryName: null,
    //         utr: null,
    //         status: null
    //     });
    // }
    const user = await userDao.getUserByUsername(req.body.clientId);
    if (!user) {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid username",
        clientOrderId: req.body.clientOrderId,
        orderId: null,
        beneficiaryName: null,
        utr: null,
        status: null,
      });
    }

    const apiToken = await apiTokenDao.getTokenByValue(req.body.secretKey);
    if (!apiToken || apiToken[0].status !== "ACTIVE") {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid token",
        clientOrderId: req.body.clientOrderId,
        orderId: null,
        beneficiaryName: null,
        utr: null,
        status: null,
      });
    }

    const result = await payoutDao.initiatePayout(
      user.id,
      {
        ...req.body,
        accountNumber: req.body.accountNo,
        amount: parseFloat(req.body.amount),
        clientOrderId: req.body.clientOrderId,
        ipAddress: req.ip,
      },
      req.body.secretKey
    );

    const statusCode =
      result.vendorResponse.statusCode === 1
        ? 1
        : result.vendorResponse.statusCode === 0
        ? 0
        : 2;

    res.send({
      statusCode: statusCode,
      message:
        statusCode === 1 ? "success" : statusCode === 0 ? "failed" : "initiate",
      clientOrderId: req.body.clientOrderId,
      orderId: result.transaction.orderId,
      beneficiaryName: result.transaction.beneficiaryName,
      utr: result.transaction.utrNumber,
      status: statusCode, // Directly use vendor status code
    });
  } catch (error) {
    console.log("error--> ", error);
    log.error("Error initiating payout:", error);
    res.status(500).send({
      statusCode: 0,
      message: error.message || "Internal server error",
      clientOrderId: req.body.clientOrderId,
      orderId: null,
      beneficiaryName: null,
      utr: null,
      status: null,
    });
  }
});

// Status Check Endpoint
payoutRouter.post("/status-check", async (req, res) => {
  try {
    const { error } = statusCheckSchema.validate(req.body);
    if (error) {
      return res.status(400).send({
        statusCode: 0,
        message: error.details[0].message,
        clientOrderId: req.body.clientOrderId,
        orderId: null,
        beneficiaryName: null,
        utr: null,
        status: null,
      });
    }

    // Validate user and token
    const user = await userDao.getUserByUsername(req.body.clientId);
    if (!user) {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid username",
        clientOrderId: req.body.clientOrderId,
        orderId: null,
        beneficiaryName: null,
        utr: null,
        status: null,
      });
    }

    const apiToken = await apiTokenDao.getTokenByValue(req.body.secretKey);
    if (!apiToken || apiToken.status !== "ACTIVE") {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid token",
        clientOrderId: req.body.clientOrderId,
        orderId: null,
        beneficiaryName: null,
        utr: null,
        status: null,
      });
    }

    const result = await payoutDao.checkStatus(
      user.id,
      req.body.clientOrderId,
      req.body.secretKey
    );

    res.send({
      statusCode: 1,
      message: result.transaction.status === "SUCCESS" ? "success" : "pending",
      clientOrderId: req.body.clientOrderId,
      orderId: result.transaction.orderId,
      beneficiaryName: result.transaction.beneficiaryName,
      utr: result.transaction.utrNumber,
      status: result.transaction.status === "SUCCESS" ? 1 : 2,
    });
  } catch (error) {
    log.error("Error checking status:", error);
    res.status(500).send({
      statusCode: 0,
      message: error.message || "Internal server error",
      clientOrderId: req.body.clientOrderId,
      orderId: null,
      beneficiaryName: null,
      utr: null,
      status: null,
    });
  }
});

payoutRouter.post("/callback", async (req, res) => {
  try {
    const encryptedData = req.body;
    if (!encryptedData) {
      return res.status(400).send({
        statusCode: 0,
        message: "Encrypted data is required",
      });
    }

    await payoutDao.processCallback(encryptedData);
    res.send({ statusCode: 1, message: "Callback processed successfully" });
  } catch (error) {
    log.error("Error processing callback:", error);
    res.status(500).send({
      statusCode: 0,
      message: "Error processing callback",
    });
  }
});

module.exports = payoutRouter;
