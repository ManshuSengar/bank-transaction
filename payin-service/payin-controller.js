// payin-service/payin-controller.js
const express = require("express");
const payinRouter = express.Router();
const payinDao = require("./payin-dao");
const apiTokenDao = require("../api-token-service/api-token-dao");
const encryptionService = require("../encryption-service/encryption-dao");
const userDao = require("../user-service/user-dao");
const Logger = require("../logger/logger");
const log = new Logger("Payin-Controller");
const Joi = require("joi");
const { authenticateToken } = require("../middleware/auth-token-validator");
const axios = require("axios");
const XLSX = require('xlsx');
const fs = require('fs').promises;
const path = require('path');

// Validation Schema
const generateQRSchema = Joi.object({
  username: Joi.string().required(),
  token: Joi.string().required(), // API Token for authentication
  data: Joi.string().required(), // Encrypted data string
});

// Public QR Generation Endpoint
payinRouter.post("/qr", async (req, res) => {
  try {
    console.log("/qr--> ", req.body);
    const { error } = generateQRSchema.validate(req.body);
    if (error) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: error.details[0].message,
      });
    }

    const { username, token, data } = req.body;
    const clientIp =
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.headers["x-forwarded-for"]?.split(",")[0];
    // Validate API Token
    // const validToken = await apiTokenDao.getValidToken(token, clientIp);
    // console.log("validate token--> ", validToken);
    const apiToken = await apiTokenDao.getTokenByValue(token);
    // console.log("apiToken--> ",apiToken);
    // if (!validToken) {
    //   return res.status(401).send({
    //     messageCode: "INVALID_TOKEN",
    //     message: "Invalid token, inactive token, or unauthorized IP address",
    //   });
    // }
    if (!apiToken[0] || apiToken[0].status !== "ACTIVE") {
      return res.status(401).send({
        messageCode: "INVALID_TOKEN",
        message: "Invalid or inactive API token",
      });
    }

    // Validate token belongs to the user
    const user = await userDao.getUserByUsername(username);
    console.log("user--> ", user);
    if (!user || apiToken[0].userId !== user.id) {
      return res.status(403).send({
        messageCode: "TOKEN_USER_MISMATCH",
        message: "Token does not belong to the specified user",
      });
    }
    // Decrypt the data
    let decryptedData;
    try {
      decryptedData = await encryptionService.decrypt(data);
    } catch (decryptError) {
      return res.status(400).send({
        messageCode: "DECRYPTION_ERROR",
        message: "Failed to decrypt payload",
      });
    }

    // Validate decrypted data structure
    if (!decryptedData.amount || !decryptedData.uniqueid) {
      return res.status(400).send({
        messageCode: "INVALID_PAYLOAD",
        message: "Payload must contain amount and uniqueid",
      });
    }

    // Generate QR for the user
    const result = await payinDao.generateQR(
      user.id,
      decryptedData.amount,
      decryptedData.uniqueid
    );

    res.status(201).send({
      messageCode: "QR_GENERATED",
      message: "QR generated successfully",
      uniqueId: result.transaction.uniqueId,
      qr: result.transaction.vendorResponse.qr,
      createdAt: result.transaction.createdAt,
      updatedAt: result.transaction.updatedAt,
    });
    
  } catch (error) {
    log.error("Error generating public QR:", error);
    res.status(error.statusCode || 500).send({
      messageCode: error.messageCode || "ERR_GENERATE_QR",
      message: error.message || "Error generating QR",
    });
  }
});

// Verify Transaction (Public Endpoint)
payinRouter.post("/verify", async (req, res) => {
  try {
    const { transactionId, username, token } = req.body;

    // Validate input
    if (!transactionId || !username || !token) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: "Transaction ID, username, and token are required",
      });
    }

    // Validate API Token
    const apiToken = await apiTokenDao.getTokenByValue(token);
    if (!apiToken || apiToken.status !== "ACTIVE") {
      return res.status(401).send({
        messageCode: "INVALID_TOKEN",
        message: "Invalid or inactive API token",
      });
    }

    // Validate token belongs to the user
    const user = await userDao.getUserByUsername(username);
    if (!user || apiToken.userId !== user.id) {
      return res.status(403).send({
        messageCode: "TOKEN_USER_MISMATCH",
        message: "Token does not belong to the specified user",
      });
    }

    const result = await payinDao.verifyTransaction(transactionId);

    res.send({
      messageCode: "TRANSACTION_VERIFIED",
      message: "Transaction details retrieved",
      transaction: result,
    });
  } catch (error) {
    log.error("Error verifying transaction:", error);
    res.status(500).send({
      messageCode: "ERR_VERIFY_TRANSACTION",
      message: "Error verifying transaction",
    });
  }
});

payinRouter.get("/transactions", async (req, res) => {
  try {
    const { username, token, page, limit, status } = req.query;

    if (!username || !token) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: "Username and token are required",
      });
    }

    const apiToken = await apiTokenDao.getTokenByValue(token);
    if (!apiToken || apiToken.status !== "ACTIVE") {
      return res.status(401).send({
        messageCode: "INVALID_TOKEN",
        message: "Invalid or inactive API token",
      });
    }

    const user = await userDao.getUserByUsername(username);
    if (!user || apiToken.userId !== user.id) {
      return res.status(403).send({
        messageCode: "TOKEN_USER_MISMATCH",
        message: "Token does not belong to the specified user",
      });
    }

    const transactions = await payinDao.getUserPayinTransactions(user.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
    });

    res.send({
      messageCode: "TRANSACTIONS_FETCHED",
      message: "User payin transactions retrieved successfully",
      ...transactions,
    });
  } catch (error) {
    log.error("Error getting transactions:", error);
    res.status(500).send({
      messageCode: "ERR_GET_TRANSACTIONS",
      message: "Error retrieving transactions",
    });
  }
});

payinRouter.get("/user/transactions", authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.user.userId);
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

    const userDetails = await userDao.getUserByUsername(req.user.username);

    const transactions = await payinDao.getFilteredTransactions({
      userId,
      startDate,
      endDate,
      status,
      search,
      minAmount: minAmount ? parseFloat(minAmount) : null,
      maxAmount: maxAmount ? parseFloat(maxAmount) : null,
      page: parseInt(page),
      limit: parseInt(limit),
    });
    console.log("tranasaction id--> ", transactions);
    res.send({
      messageCode: "TRANSACTIONS_FETCHED",
      message: "Transactions retrieved successfully",
      data: transactions.data.map((transaction) => ({
        transactionId: transaction?.transactionId,
        amount: transaction.amount,
        uniqueId: transaction.uniqueId,
        chargeValue: transaction.chargeValue,
        gstAmount: transaction.gstAmount,
        status: transaction.status,
        createdAt: transaction.createdAt,
      })),
      pagination: transactions.pagination,
      summary: transactions.summary,
    });
  } catch (error) {
    console.log("Error getting filtered transactions:", error);
    log.error("Error getting filtered transactions:", error);
    res.status(500).send({
      messageCode: "ERR_GET_TRANSACTIONS",
      message: "Error retrieving transactions",
    });
  }
});

payinRouter.get("/admin/transactions", async (req, res) => {
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

    const transactions = await payinDao.getAdminFilteredTransactions({
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
      message: "All user payin transactions retrieved successfully",
      data: transactions.data.map((transaction) => ({
        transactionId: transaction?.transactionId,
        amount: transaction.amount,
        uniqueId: transaction.uniqueId,
        chargeValue: transaction.chargeValue,
        gstAmount: transaction.gstAmount,
        status: transaction.status,
        createdAt: transaction.createdAt,
        userId: transaction.userId,
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
    console.log("Error getting admin transactions:", error);
    log.error("Error getting admin transactions:", error);
    res.status(500).send({
      messageCode: "ERR_GET_ADMIN_TRANSACTIONS",
      message: "Error retrieving admin payin transactions",
    });
  }
});

// In payin-controller.js
payinRouter.post("/check-status", async (req, res) => {
  try {
    const { uniqueId, username } = req.body;

    if (!uniqueId || !username) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: "Unique ID and username are required",
      });
    }

    // Get user and transaction
    const user = await userDao.getUserByUsername(username);
    const transaction = await payinDao.getTransactionByUniqueId(uniqueId);
    console.log("transaction--> ", transaction);
    if (!transaction || !user || transaction.userId !== user.id) {
      return res.status(404).send({
        messageCode: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found",
      });
    }

    if (transaction.status === "SUCCESS") {
      return res.send({
        messageCode: "ALREADY_SUCCESS",
        message: "Transaction already successful",
        status: transaction.status,
        transactionId: transaction.transactionId,
      });
    }

    const vendorResponse = await axios.post(
      process.env.VENDOR_CHECK_STATUS_API,
      {
        reseller_id: process.env.RESELLER_ID,
        reseller_pass: process.env.RESELLER_PASSWORD,
        uniqueid: transaction?.transactionId,
      }
    );
  

    if (!vendorResponse.data.Status) {
      return res.status(400).send({
        messageCode: "VENDOR_ERROR",
        message: "Error checking status",
      });
    }
    const statusData = vendorResponse.data.Data;
    const amount = parseFloat(statusData.TxnAmount);
    const newStatus = statusData.Status;

    if (newStatus !== "PENDING" && newStatus !== transaction.status) {
      await payinDao.processStatusChange(
        transaction,
        newStatus === "SUCCESS",
        amount,
        statusData.BankRRN
      );
    }

    const updatedTransaction = await payinDao.getTransactionByUniqueId(
      uniqueId
    );
    res.send({
      messageCode: "STATUS_CHECKED",
      message: "Status checked successfully",
      status: updatedTransaction.status,
      transactionId: updatedTransaction.transactionId,
      bankRRN: updatedTransaction.vendorTransactionId,
    });
  } catch (error) {
    console.log("error--> ", error);
    log.error("Error checking status:", error);
    res.status(500).send({
      messageCode: "ERR_CHECK_STATUS",
      message: "Error checking status",
    });
  }
});

// Admin check status endpoint
payinRouter.post("/admin/check-status", async (req, res) => {
  try {
    const { uniqueId } = req.body;

    if (!uniqueId) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: "Unique ID is required",
      });
    }

    const transaction = await payinDao.getTransactionByUniqueId(uniqueId);
    if (!transaction) {
      return res.status(404).send({
        messageCode: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found",
      });
    }

    const originalStatus = transaction.status;

    if (originalStatus === "SUCCESS") {
      return res.send({
        messageCode: "ALREADY_SUCCESS",
        message: "Transaction already completed successfully",
        description: "Money has been credited to collection wallet",
        status: originalStatus,
        transactionId: transaction.transactionId,
      });
    }

    const vendorResponse = await axios.post(
      process.env.VENDOR_CHECK_STATUS_API,
      {
        reseller_id: process.env.RESELLER_ID,
        reseller_pass: process.env.RESELLER_PASSWORD,
        uniqueid: transaction?.transactionId,
      }
    );
     console.log("vendorResponse.data. ",vendorResponse.data);
    if (!vendorResponse.data.Status) {
      return res.status(400).send({
        messageCode: "VENDOR_ERROR",
        message: "Error checking transaction status with vendor",
      });
    }

    const statusData = vendorResponse.data.Data;
    const amount = parseFloat(statusData.TxnAmount);
    const newStatus = statusData.Status;

    let statusDescription = "";
    if (originalStatus === "PENDING" && newStatus === "SUCCESS") {
      statusDescription =
        "Transaction successful - Amount credited to collection wallet";
    } else if (originalStatus === "PENDING" && newStatus === "FAILED") {
      statusDescription = "Transaction failed - Amount reversed or not debited";
    } else if (newStatus === "PENDING") {
      statusDescription = "Transaction is still being processed";
    }

    if (newStatus !== "PENDING" && newStatus !== transaction.status) {
      await payinDao.processStatusChange(
        transaction,
        newStatus === "SUCCESS",
        amount,
        statusData.BankRRN
      );
    }

    const updatedTransaction = await payinDao.getTransactionByUniqueId(
      uniqueId
    );

    res.send({
      messageCode: "STATUS_CHECKED",
      message: "Status check completed successfully",
      previousStatus: originalStatus,
      currentStatus: updatedTransaction.status,
      description: statusDescription,
      transactionId: updatedTransaction.transactionId,
      bankRRN: updatedTransaction.vendorTransactionId,
      amount: updatedTransaction.amount,
    });
  } catch (error) {
    log.error("Error checking status:", error);
    res.status(500).send({
      messageCode: "ERR_CHECK_STATUS",
      message: "Error checking transaction status",
    });
  }
});

payinRouter.get("/admin/transactions/download", async (req, res) => {
  try {
      const {
          startDate,
          endDate,
          status,
          search,
          minAmount,
          maxAmount,
      } = req.query;

      const transactions = await payinDao.getAdminFilteredTransactions({
          startDate,
          endDate,
          status,
          search,
          minAmount: minAmount ? parseFloat(minAmount) : null,
          maxAmount: maxAmount ? parseFloat(maxAmount) : null,
          page: 1,
          limit: 100000 
      });

      const excelData = transactions.data.map((transaction) => ({
          'Transaction ID': transaction.transactionId || 'N/A',
          'Amount': transaction.amount,
          'Unique ID': transaction.uniqueId,
          'Charge Value': transaction.chargeValue,
          'GST Amount': transaction.gstAmount,
          'Status': transaction.status,
          'Created At': new Date(transaction.createdAt).toLocaleString(),
          'User ID': transaction.userId,
          'Username': transaction.user.username,
          'Full Name': `${transaction.user.firstname} ${transaction.user.lastname}`,
          'Email': transaction.user.emailId,
          'Phone No': transaction.user.phoneNo
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payin Transactions');

      const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
      const filename = `payin_transactions_${timestamp}.xlsx`;
      const filepath = path.join(__dirname, '..', 'uploads', 'exports', filename);

      await fs.mkdir(path.dirname(filepath), { recursive: true });

      XLSX.writeFile(workbook, filepath);

      res.download(filepath, filename, async (err) => {
          if (err) {
              console.error('Download error:', err);
          }
          await fs.unlink(filepath).catch(() => {});
      });

  } catch (error) {
      console.log("Error downloading admin transactions:", error);
      log.error("Error downloading admin transactions:", error);
      res.status(500).send({
          messageCode: "ERR_DOWNLOAD_TRANSACTIONS",
          message: "Error downloading transactions",
      });
  }
});

// Admin endpoint to manually mark pending transactions as failed
payinRouter.post("/admin/mark-failed", authenticateToken, async (req, res) => {
  try {
    const { uniqueId } = req.body;

    if (!uniqueId) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: "Unique ID is required"
      });
    }

    // Verify user has permission to perform this action
    // if (!req.user.permissions.includes('manage_transactions')) {
    //   return res.status(403).send({
    //     messageCode: "FORBIDDEN",
    //     message: "You do not have permission to mark transactions as failed"
    //   });
    // }

    const transaction = await payinDao.getTransactionByUniqueId(uniqueId);
    
    if (!transaction) {
      return res.status(404).send({
        messageCode: "TRANSACTION_NOT_FOUND",
        message: "Transaction not found"
      });
    }

    // Only allow marking pending transactions as failed
    if (transaction.status !== "PENDING") {
      return res.status(400).send({
        messageCode: "INVALID_STATUS",
        message: "Only pending transactions can be marked as failed"
      });
    }

    const updatedTransaction = await payinDao.processStatusChange(
      transaction, 
      false, // isSuccess = false (marking as failed)
      transaction.amount, 
      null // No bank RRN
    );

    res.send({
      messageCode: "TRANSACTION_MARKED_FAILED",
      message: "Transaction successfully marked as failed",
      transaction: {
        uniqueId: updatedTransaction.uniqueId,
        status: updatedTransaction.status,
        amount: updatedTransaction.amount
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



module.exports = payinRouter;
