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
const { DatabaseError } = require("pg");
const { authenticateToken } = require("../middleware/auth-token-validator");
const telegramDao = require("../telegram-service/telegram-dao");
const walletDao = require("../wallet-service/wallet-dao");
const apiConfigDao=require("../api-config-service/api-config-dao");
const axios=require("axios");
const XLSX = require('xlsx');
const fs = require('fs').promises;
const path = require('path');
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

const balanceCheckSchema = Joi.object({
  clientId: Joi.string().required(), // username
  secretKey: Joi.string().required(), // token
});

function handleDatabaseError(
  error,
  req,
  res,
  defaultMessage = "Database error"
) {
  log.error("Database Error:", error);

  // PostgreSQL unique constraint violation
  if (error.code === "23505") {
    return res.status(409).send({
      statusCode: 0,
      message: "Duplicate client order ID or transaction already exists",
      clientOrderId: req.body.clientOrderId,
      orderId: null,
      beneficiaryName: null,
      utr: null,
      status: null,
    });
  }

  if (error.code === "23503") {
    return res.status(400).send({
      statusCode: 0,
      message:
        "Invalid reference: User, scheme, or API configuration not found",
      clientOrderId: req.body.clientOrderId,
      orderId: null,
      beneficiaryName: null,
      utr: null,
      status: null,
    });
  }

  return res.status(500).send({
    statusCode: 0,
    message: defaultMessage,
    clientOrderId: req.body.clientOrderId,
    orderId: null,
    beneficiaryName: null,
    utr: null,
    status: null,
  });
}

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
    if (error instanceof DatabaseError) {
      return handleDatabaseError(
        error,
        req,
        res,
        "Error in account validation"
      );
    }

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

    let responseStatus;
    if (result.vendorResponse.statusCode === 0) {
      responseStatus = {
        statusCode: 0,
        status: 0, 
        message: "failed"
      };
    } else if (result.vendorResponse.statusCode === 1) {
      switch (result.vendorResponse.status) {
        case 1:
          responseStatus = {
            statusCode: 1,
            status: 1, 
            message: "success"
          };
          break;
        case 0:
          responseStatus = {
            statusCode: 1,
            status: 0, 
            message: "failed"
          };
          break;
        case 4:
          responseStatus = {
            statusCode: 1,
            status: 4,
            message: "reversed"
          };
          break;
        default:
          responseStatus = {
            statusCode: 1,
            status: 2, 
            message: "pending"
          };
      }
    } else {
      responseStatus = {
        statusCode: 2,
        status: 2,
        message: "initiate"
      };
    }

    res.send({
      statusCode: responseStatus.statusCode,
      message: responseStatus.message,
      clientOrderId: req.body.clientOrderId,
      orderId: result.transaction.internalId,
      beneficiaryName: result.transaction.beneficiaryName,
      utr: result.transaction.utrNumber,
      status: responseStatus.status,
      amount: result.transaction.amount,
    });
    return;
  } catch (error) {
    console.log("error--> ", error);

    if (error instanceof DatabaseError) {
      return handleDatabaseError(error, req, res, "Error in account validation");
    }
    
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
    return;
  }
});

payoutRouter.get("/user/transactions", authenticateToken, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      status,
      search,
      minAmount,
      maxAmount,
      page = 1,
      limit = 10,
    } = req.query;

    const transactions = await payoutDao.getFilteredTransactions({
      userId: req.user.userId,
      startDate,
      endDate,
      status,
      search,
      minAmount: minAmount ? parseFloat(minAmount) : null,
      maxAmount: maxAmount ? parseFloat(maxAmount) : null,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.send({
      messageCode: "TRANSACTIONS_FETCHED",
      message: "Transactions retrieved successfully",
      data: transactions.data.map((transaction) => ({
        id: transaction.id,
        clientOrderId: transaction.clientOrderId,
        amount: transaction.amount,
        beneficiaryName: transaction.beneficiaryName,
        accountNumber: transaction.accountNumber,
        ifscCode: transaction.ifscCode,
        utrNumber: transaction.utrNumber,
        status: transaction.status,
        chargeValue: transaction.chargeValue,
        gstAmount: transaction.gstAmount,
        createdAt: transaction.createdAt,
      })),
      pagination: transactions.pagination,
      summary: transactions.summary,
    });
  } catch (error) {
    log.error("Error getting filtered transactions:", error);
    res.status(500).send({
      messageCode: "ERR_GET_TRANSACTIONS",
      message: "Error retrieving transactions",
    });
  }
});

payoutRouter.get("/admin/transactions", authenticateToken, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      status,
      search,
      minAmount,
      maxAmount,
      page = 1,
      limit = 10,
    } = req.query;

    const transactions = await payoutDao.getAdminFilteredTransactions({
      startDate,
      endDate,
      status,
      search,
      minAmount: minAmount ? parseFloat(minAmount) : null,
      maxAmount: maxAmount ? parseFloat(maxAmount) : null,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.send({
      messageCode: "ADMIN_TRANSACTIONS_FETCHED",
      message: "All payout transactions retrieved successfully",
      data: transactions.data.map((transaction) => ({
        id: transaction.id,
        clientOrderId: transaction.clientOrderId,
        orderId: transaction.orderId,
        amount: transaction.amount,
        transferMode: transaction.transferMode,
        beneficiaryName: transaction.beneficiaryName,
        accountNumber: transaction.accountNumber,
        ifscCode: transaction.ifscCode,
        utrNumber: transaction.utrNumber,
        status: transaction.status,
        chargeValue: transaction.chargeValue,
        gstAmount: transaction.gstAmount,
        createdAt: transaction.createdAt,
        userId: transaction.user.id,
        username: transaction.user.username,
        firstname: transaction.user.firstname,
        lastname: transaction.user.lastname,
        emailId: transaction.user.emailId,
        phoneNo: transaction.user.phoneNo,
      })),
      pagination: transactions.pagination,
      summary: transactions.summary,
    });
  } catch (error) {
    console.log("error--> ", error);
    log.error("Error getting admin transactions:", error);
    res.status(500).send({
      messageCode: "ERR_GET_ADMIN_TRANSACTIONS",
      message: "Error retrieving admin payout transactions",
    });
  }
});

payoutRouter.get(
  "/admin/transactions/download",
  authenticateToken,
  async (req, res) => {
    try {
      const { startDate, endDate, status, search, minAmount, maxAmount } =
        req.query;

      const transactions = await payoutDao.getAdminFilteredTransactions({
        startDate,
        endDate,
        status,
        search,
        minAmount: minAmount ? parseFloat(minAmount) : null,
        maxAmount: maxAmount ? parseFloat(maxAmount) : null,
        page: 1,
        limit: 100000,
      });

      const excelData = transactions.data.map((transaction) => ({
        "Transaction ID": transaction.clientOrderId,
        "Order ID": transaction.orderId,
        Amount: transaction.amount,
        "Transfer Mode": transaction.transferMode,
        "Beneficiary Name": transaction.beneficiaryName,
        "Account Number": transaction.accountNumber,
        "IFSC Code": transaction.ifscCode,
        "UTR Number": transaction.utrNumber,
        Status: transaction.status,
        "Charge Value": transaction.chargeValue,
        "GST Amount": transaction.gstAmount,
        "Created At": new Date(transaction.createdAt).toLocaleString(),
        Username: transaction.user.username,
        "Full Name": `${transaction.user.firstname} ${transaction.user.lastname}`,
        Email: transaction.user.emailId,
        Phone: transaction.user.phoneNo,
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Payout Transactions");

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `payout_transactions_${timestamp}.xlsx`;
      const filepath = path.join(
        __dirname,
        "..",
        "uploads",
        "exports",
        filename
      );

      await fs.mkdir(path.dirname(filepath), { recursive: true });
      XLSX.writeFile(workbook, filepath);

      res.download(filepath, filename, async (err) => {
        if (err) {
          log.error("Download error:", err);
        }
        await fs.unlink(filepath).catch(() => {});
      });
    } catch (error) {
      console.log("Error downloading transactions:", error);
      log.error("Error downloading transactions:", error);
      res.status(500).send({
        messageCode: "ERR_DOWNLOAD_TRANSACTIONS",
        message: "Error downloading transactions",
      });
    }
  }
);

payoutRouter.post(
  "/admin/check-status",
  authenticateToken,
  async (req, res) => {
    try {
      const { clientOrderId } = req.body;

      if (!clientOrderId) {
        return res.status(400).send({
          messageCode: "VALIDATION_ERROR",
          message: "Client Order ID is required",
        });
      }

      const transaction = await payoutDao.getTransactionByClientOrderId(
        clientOrderId
      );
      if (!transaction) {
        return res.status(404).send({
          messageCode: "TRANSACTION_NOT_FOUND",
          message: "Transaction not found",
        });
      }

      const result = await payoutDao.checkStatusWithVendor(transaction);

      const statusMapping = {
        SUCCESS: "success",
        FAILED: "failed",
        PENDING: "pending",
        REVERSED: "reversed",
      };
       res.send({
        messageCode: "STATUS_CHECKED",
        message: `Transaction status: ${statusMapping[result.status]}`,
        data: {
          clientOrderId: transaction.clientOrderId,
          orderId: transaction.orderId,
          amount: transaction.amount,
          beneficiaryName: transaction.beneficiaryName,
          previousStatus: transaction.status,
          currentStatus: result.status,
          utrNumber: result.utrNumber,
          statusDescription: result.description,
        },
      });
      return;
    } catch (error) {
      console.log("error--> ", error);
      log.error("Error checking status:", error);
     return res.status(500).send({
        messageCode: "ERR_CHECK_STATUS",
        message: "Error checking transaction status",
      });
    }
  }
);

// Process vendor callback
payoutRouter.post("/callback", async (req, res) => {
  try {
    const callbackData = req.body;
    if (!callbackData || !callbackData.ClientOrderId) {
      return res.status(400).send({
        StatusCode: 0,
        Message: "Invalid callback data",
      });
    }

    await payoutDao.processCallback(callbackData);

    // Return success response in the expected format
    res.send({
      StatusCode: 1,
      Message: "Callback processed successfully",
    });
  } catch (error) {
    log.error("Error processing callback:", error);
    // Still return success to vendor but log the error
    res.send({
      StatusCode: 1,
      Message: "Callback acknowledged",
    });
  }
});

payoutRouter.post("/check-balance", async (req, res) => {
  try {
    const { error } = balanceCheckSchema.validate(req.body);
    if (error) {
      return res.status(400).send({
        statusCode: 0,
        message: error.details[0].message,
        balance: null,
      });
    }

    const user = await userDao.getUserByUsername(req.body.clientId);
    if (!user) {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid username",
        balance: null,
      });
    }

    const apiToken = await apiTokenDao.getTokenByValue(req.body.secretKey);
    if (!apiToken || apiToken[0].status !== "ACTIVE") {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid token",
        balance: null,
      });
    }

    const userWallets = await walletDao.getUserWallets(user.id);
    const payoutWallet = userWallets.find((w) => w.type.name === "PAYOUT");

    if (!payoutWallet) {
      return res.status(404).send({
        statusCode: 0,
        message: "Payout wallet not found",
        balance: null,
      });
    }

    res.send({
      statusCode: 1,
      message: "Balance retrieved successfully",
      balance: payoutWallet.wallet.balance || 0,
    });
  } catch (error) {
    log.error("Error checking balance:", error);
    res.status(500).send({
      statusCode: 0,
      message: "Error retrieving balance",
      balance: null,
    });
  }
});

payoutRouter.get(
  "/admin/check-balance",
  authenticateToken,
  async (req, res) => {
    try {
      const apiConfig = await apiConfigDao.getDefaultApiConfig(2);
      if (!apiConfig) {
        throw new Error("No API configuration found for Payout");
      }
      const response = await axios.post(
        `${apiConfig.baseUrl}/api/api/api-module/payout/balance`,
        {
          clientId: process.env.PAYOUT_CLIENT_ID,
          secretKey: process.env.PAYOUT_SECRET_KEY,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.statusCode !== 1) {
        throw new Error(
          response.data.message || "Failed to fetch vendor balance"
        );
      }
      const balance = response.data.balance;

      // if (balance < 1000) {
      //   const alertMessage =
      //     `🚨 *LOW VENDOR BALANCE ALERT*\n\n` +
      //     `*Current Balance:* ₹${balance.toLocaleString("en-IN")}\n` +
      //     `*Status:* Critical - Below minimum threshold\n` +
      //     `*Action Required:* Immediate top-up needed\n\n` +
      //     `Please add funds to avoid service interruption.`;

      //   await telegramDao.sendMessage(alertMessage);
      // }

      res.send({
        messageCode: "VENDOR_BALANCE_FETCHED",
        message: "Vendor balance retrieved successfully",
        balance: balance,
        status: balance < 500 ? "LOW" : "SUFFICIENT",
      });
    } catch (error) {
      console.log("Error checking vendor balance:", error);
      log.error("Error checking vendor balance:", error);
      res.status(500).send({
        messageCode: "ERR_CHECK_VENDOR_BALANCE",
        message: error.message || "Error retrieving vendor balance",
      });
    }
  }
);


payoutRouter.get("/system-logs", authenticateToken, async (req, res) => {
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
      filters.searchType = ["all", "transactionId", "orderId"].includes(searchType)
        ? searchType
        : "all";
    }

    const systemLogs = await payoutDao.getFilteredSystemLogs(filters);

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
    log.error("Error retrieving filtered system logs:", error);
    res.status(error.statusCode || 500).send({
      messageCode: error.messageCode || "ERR_FETCH_SYSTEM_LOGS",
      message: error.message || "Error retrieving system logs",
    });
  }
});

payoutRouter.get('/user-logs', authenticateToken, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {
      userId: req.user.userId,
      limit: Math.min(parseInt(limit) || 50, 100), 
      offset: parseInt(offset) || 0
    };
    
    if (startDate && Date.parse(startDate)) {
      filters.startDate = new Date(startDate);
    }

    if (endDate && Date.parse(endDate)) {
      filters.endDate = new Date(endDate);
    }

    const userLogs = await payoutDao.getFilteredUserCallbackLogs(filters);
    
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

payoutRouter.post("/admin/mark-failed", authenticateToken, async (req, res) => {
  try {
    const { clientOrderId } = req.body;

    if (!clientOrderId) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: "Client Order ID is required"
      });
    }

    const transaction = await payoutDao.getTransactionByClientOrderId(clientOrderId);
    
    if (!transaction) {
      return res.status(404).send({
        messageCode: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found"
      });
    }

    if (transaction.status !== "PENDING") {
      return res.status(400).send({
        messageCode: "INVALID_STATUS",
        message: "Only pending transactions can be marked as failed"
      });
    }

    const updatedTransaction = await payoutDao.manuallyMarkFailed(transaction);

    res.send({
      messageCode: "TRANSACTION_MARKED_FAILED",
      message: "Transaction successfully marked as failed",
      transaction: {
        clientOrderId: updatedTransaction.clientOrderId,
        status: updatedTransaction.status,
        amount: updatedTransaction.amount,
        orderId: updatedTransaction.orderId,
        utrNumber: updatedTransaction.utrNumber
      }
    });
  } catch (error) {
    log.error("Error marking transaction as failed:", error);
    res.status(500).send({
      messageCode: "ERR_MARK_FAILED",
      message: "Error marking transaction as failed"
    });
  }
});

module.exports = payoutRouter;
