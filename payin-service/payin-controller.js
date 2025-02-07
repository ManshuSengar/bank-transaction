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
const XLSX = require("xlsx");
const path = require("path");
const moment =require('moment');
const paymentStatusScheduler = require("../scheduler/payment-status-scheduler");
const multer = require('multer');
const fs = require('fs').promises;


const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
      const dir = path.join(__dirname, '../uploads/bulk-transactions');
      try {
          await fs.mkdir(dir, { recursive: true });
          cb(null, dir);
      } catch (error) {
          cb(error);
      }
  },
  filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'bulk-failed-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
  ];
  if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
  } else {
      cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
      fileSize: 15 * 1024 * 1024 // 5MB limit
  }
});

// Validation Schema
const generateQRSchema = Joi.object({
  username: Joi.string().required(),
  token: Joi.string().required(), // API Token for authentication
  data: Joi.string().required(), // Encrypted data string
});

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
    const apiToken = await apiTokenDao.getTokenByValue(token);
    if (!apiToken[0] || apiToken[0].status !== "ACTIVE") {
      return res.status(401).send({
        messageCode: "INVALID_TOKEN",
        message: "Invalid or inactive API token",
      });
    }

    const user = await userDao.getUserByUsername(username);
    console.log("user--> ", user);
    if (!user || apiToken[0].userId !== user.id) {
      return res.status(403).send({
        messageCode: "TOKEN_USER_MISMATCH",
        message: "Token does not belong to the specified user",
      });
    }
    let decryptedData;
    try {
      decryptedData = await encryptionService.decrypt(data);
    } catch (decryptError) {
      return res.status(400).send({
        messageCode: "DECRYPTION_ERROR",
        message: "Failed to decrypt payload",
      });
    }

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
      decryptedData.uniqueid,
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
    console.log("payin controller error ",error);
    log.error("Error generating public QR:", error);
    res.status(error.statusCode || 500).send({
      messageCode: error.messageCode || "ERR_GENERATE_QR",
      message: error.message || "Error generating QR",
    });
  }
});

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
        updatedAt:transaction.updatedAt,
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

payinRouter.post("/check-status", async (req, res) => {
  try {
    const { uniqueId, username } = req.body;
    console.log("uniqueId",uniqueId);
    if (!uniqueId || !username) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: "Unique ID and username are required",
      });
    }

    const user = await userDao.getUserByUsername(username);
    const transaction = await payinDao.getTransactionByUniqueId(uniqueId);
    console.log("user--> ",user,"--> ",transaction);
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
    console.log("process.env.RESELLER_ID--> ",process.env.RESELLER_ID);
    const vendorResponse = await axios.post(
      process.env.VENDOR_CHECK_STATUS_API,
      {
        reseller_id: process.env.RESELLER_ID,
        reseller_pass: process.env.RESELLER_PASSWORD,
        uniqueid: transaction?.transactionId,
      }
    );
    console.log("vendorResponse--> ", vendorResponse?.data);

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
        newStatus === "APPROVED",
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

    if (originalStatus === "FAILED") {
      return res.send({
        messageCode: "ALREADY_FAILED",
        message: "Transaction already marked as failed",
        description: "Transaction charges have been refunded to service wallet",
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
    console.log("vendorResponse.data. ", vendorResponse.data);
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
    if (originalStatus === "PENDING" && newStatus === "APPROVED") {
      statusDescription =
        "Transaction successful - Amount credited to collection wallet";
    } else if (originalStatus === "PENDING" && newStatus === "FAILED") {
      statusDescription = "Transaction failed - Amount reversed or not debited";
    } else if (newStatus === "PENDING") {
      statusDescription = "Transaction is still being processed";
    } else if (originalStatus === "FAILED" && newStatus === "APPROVED") {
      statusDescription =
        "Status changed from failed to approved - Updating wallet balances";
    } else if (originalStatus === "APPROVED" && newStatus === "FAILED") {
      statusDescription =
        "Status changed from approved to failed - Reversing wallet transactions";
    }

    console.log("newStatus--> ", transaction.status, newStatus);
    if (newStatus !== "PENDING" && newStatus !== transaction.status) {
      console.log("newStatus23--> ", transaction.status);
      await payinDao.processStatusChange(
        transaction,
        newStatus === "APPROVED",
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
    const { startDate, endDate, status, search, minAmount, maxAmount } =
      req.query;

    const transactions = await payinDao.getAdminFilteredTransactions({
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
      "Transaction ID": transaction.transactionId || "N/A",
      Amount: transaction.amount,
      "Unique ID": transaction.uniqueId,
      "Charge Value": transaction.chargeValue,
      "GST Amount": transaction.gstAmount,
      Status: transaction.status,
      "Created At": moment.utc(transaction.createdAt).format("DD/MM/YYYY HH:mm:ss"),
      "Updated At": moment.utc(transaction.updatedAt).format("DD/MM/YYYY HH:mm:ss"),
      "User ID": transaction.userId,
      Username: transaction.user.username,
      "Full Name": `${transaction.user.firstname} ${transaction.user.lastname}`,
      Email: transaction.user.emailId,
      "Phone No": transaction.user.phoneNo,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    worksheet['!cols'] = [
      { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, 
      { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 10 },
      { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payin Transactions");
    const timestamp = new Date().toISOString().replace(/[:\.]/g, "-");
    const filename = `payin_transactions_${timestamp}.xlsx`;
    const filepath = path.join(__dirname, "..", "uploads", "exports", filename);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    XLSX.writeFile(workbook, filepath);
    res.download(filepath, filename, async (err) => {
      if (err) {
        console.error("Download error:", err);
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

payinRouter.post("/admin/mark-failed", authenticateToken, async (req, res) => {
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

    if (transaction.status !== "PENDING") {
      return res.status(400).send({
        messageCode: "INVALID_STATUS",
        message: "Only pending transactions can be marked as failed",
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
        amount: updatedTransaction.amount,
      },
    });
  } catch (error) {
    log.error("Error marking transaction as failed:", error);
    res.status(500).send({
      messageCode: "ERR_MARK_FAILED",
      message: "Error marking transaction as failed",
    });
  }
});

payinRouter.get(
  "/user/transactions/download",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = parseInt(req.user.userId);
      const { startDate, endDate, status, search, minAmount, maxAmount } =
        req.query;

      const transactions = await payinDao.getFilteredTransactions({
        userId,
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
        "Transaction ID": transaction.transactionId || "N/A",
        Amount: transaction.amount,
        "Unique ID": transaction.uniqueId,
        "Charge Value": transaction.chargeValue,
        "GST Amount": transaction.gstAmount,
        Status: transaction.status,
        "Created At": moment.utc(transaction.createdAt).format("DD/MM/YYYY HH:mm:ss"),
        "Bank RRN": transaction.vendorTransactionId || "N/A",
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "My Transactions");

      const timestamp = new Date().toISOString().replace(/[:\.]/g, "-");
      const filename = `user_transactions_${timestamp}.xlsx`;
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
          console.error("Download error:", err);
        }
        await fs.unlink(filepath).catch(() => {});
      });
    } catch (error) {
      console.log("Error downloading user transactions:", error);
      log.error("Error downloading user transactions:", error);
      res.status(500).send({
        messageCode: "ERR_DOWNLOAD_TRANSACTIONS",
        message: "Error downloading transactions",
      });
    }
  }
);

// payinRouter.post("/trigger-payment-status", authenticateToken, async (req, res) => {
//   try {
//     const result = await paymentStatusScheduler.manualTrigger();
//     if (result.success) {
//       res.status(200).send({
//         messageCode: "SCHEDULER_TRIGGERED",
//         message: result.message
//       });
//     } else {
//       res.status(500).send({
//         messageCode: "SCHEDULER_FAILED",
//         message: result.message,
//         error: result.error
//       });
//     }
//   } catch (error) {
//     log.error("Error triggering scheduler:", error);
//     res.status(500).send({
//       messageCode: "ERR_TRIGGER_SCHEDULER",
//       message: "Failed to trigger scheduler"
//     });
//   }
// });

// payinRouter.post("/stop-payment-status", authenticateToken, async (req, res) => {
//   try {
//     const result = await paymentStatusScheduler.stop();
//     if (result.success) {
//       res.status(200).send({
//         messageCode: "SCHEDULER_STOPPED",
//         message: result.message
//       });
//     } else {
//       res.status(500).send({
//         messageCode: "SCHEDULER_STOP_FAILED",
//         message: result.message
//       });
//     }
//   } catch (error) {
//     log.error("Error stopping scheduler:", error);
//     res.status(500).send({
//       messageCode: "ERR_STOP_SCHEDULER",
//       message: "Failed to stop scheduler"
//     });
//   }
// });

// payinRouter.post("/admin/mark-all-pending-failed", async (req, res) => {
//   try {
//     const batchProcessor = require("../scheduler/batch-failed-transaction");
//     const result = await batchProcessor.markPendingTransactionsAsFailed();
    
//     res.send({
//       messageCode: "PENDING_TRANSACTIONS_MARKED_FAILED",
//       message: result.message,
//       processedCount: result.processedCount
//     });
//   } catch (error) {
//     console.log("error--> ",error);
//     log.error("Error in bulk marking transactions as failed:", error);
//     res.status(500).send({
//       messageCode: "ERR_BULK_MARK_FAILED",
//       message: "Error marking pending transactions as failed"
//     });
//   }
// });


payinRouter.post("/admin/bulk-mark-failed", authenticateToken, async (req, res) => {
  try {
    console.log("testing");
      upload.single('file')(req, res, async function(err) {
          if (err instanceof multer.MulterError) {
              return res.status(400).send({
                  messageCode: "UPLOAD_ERROR",
                  message: err.message
              });
          } else if (err) {
              return res.status(400).send({
                  messageCode: "INVALID_FILE",
                  message: err.message
              });
          }

          if (!req.file) {
              return res.status(400).send({
                  messageCode: "NO_FILE",
                  message: "Please upload an Excel file"
              });
          }

          const results = {
              successful: [],
              failed: [],
              skipped: []
          };

          try {
              // Read Excel file
              const workbook = XLSX.readFile(req.file.path);
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              const data = XLSX.utils.sheet_to_json(worksheet);

              if (data.length === 0) {
                  throw new Error('Excel file is empty');
              }

              if (!data[0].hasOwnProperty('Unique ID')) {
                  throw new Error('Excel file must contain a "Unique ID" column');
              }

              // Process transactions in batches
              const batchSize = 50;
              for (let i = 0; i < data.length; i += batchSize) {
                  const batch = data.slice(i, i + batchSize);
                  
                  await Promise.all(batch.map(async (row) => {
                      try {
                          const uniqueId = row['Unique ID']?.toString();
                          
                          if (!uniqueId) {
                              results.skipped.push({
                                  uniqueId: 'N/A',
                                  reason: 'Missing Unique ID'
                              });
                              return;
                          }

                          console.log("uniqueId--> ",uniqueId);

                          const transaction = await payinDao.getTransactionByUniqueId(uniqueId);
                           console.log("transaction__. ",transaction);
                          if (!transaction) {
                              results.failed.push({
                                  uniqueId,
                                  reason: 'Transaction not found'
                              });
                              return;
                          }

                          if (transaction.status !== 'PENDING') {
                              results.skipped.push({
                                  uniqueId,
                                  reason: `Invalid status: ${transaction.status}`
                              });
                              return;
                          }

                          // Process the status change
                          const updatedTransaction = await payinDao.processStatusChangeWithTransaction(
                              transaction,
                              false,
                              transaction.amount,
                              null
                          );

                          if (updatedTransaction) {
                              results.successful.push({
                                  uniqueId,
                                  amount: transaction.amount
                              });
                          } else {
                              results.failed.push({
                                  uniqueId,
                                  reason: 'Status change failed'
                              });
                          }
                      } catch (error) {
                          results.failed.push({
                              uniqueId: row['Unique ID']?.toString() || 'N/A',
                              reason: error.message || 'Processing error'
                          });
                      }
                  }));
              }

              // Generate summary report
              const summaryWorkbook = XLSX.utils.book_new();
              
              // Success sheet
              const successSheet = XLSX.utils.json_to_sheet(results.successful.map(item => ({
                  'Unique ID': item.uniqueId,
                  'Amount': item.amount,
                  'Status': 'Marked as Failed'
              })));
              XLSX.utils.book_append_sheet(summaryWorkbook, successSheet, 'Successful');

              // Failed sheet
              const failedSheet = XLSX.utils.json_to_sheet(results.failed.map(item => ({
                  'Unique ID': item.uniqueId,
                  'Reason': item.reason
              })));
              XLSX.utils.book_append_sheet(summaryWorkbook, failedSheet, 'Failed');

              // Skipped sheet
              const skippedSheet = XLSX.utils.json_to_sheet(results.skipped.map(item => ({
                  'Unique ID': item.uniqueId,
                  'Reason': item.reason
              })));
              XLSX.utils.book_append_sheet(summaryWorkbook, skippedSheet, 'Skipped');

              // Save summary file
              const summaryFilename = `bulk-mark-failed-summary-${Date.now()}.xlsx`;
              const summaryPath = path.join(__dirname, '../uploads/reports', summaryFilename);
              
              await fs.mkdir(path.dirname(summaryPath), { recursive: true });
              XLSX.writeFile(summaryWorkbook, summaryPath);

              res.download(summaryPath, summaryFilename, async (err) => {
                  if (err) {
                      console.error("Download error:", err);
                  }
                  try {
                      await fs.unlink(req.file.path);
                      await fs.unlink(summaryPath);
                  } catch (cleanupError) {
                      console.error("Cleanup error:", cleanupError);
                  }
              });

          } catch (error) {
              // Cleanup uploaded file in case of error
              try {
                  await fs.unlink(req.file.path);
              } catch (cleanupError) {
                  console.error("Cleanup error:", cleanupError);
              }
              
              throw error;
          }
      });
  } catch (error) {
      console.error("Error in bulk marking transactions as failed:", error);
      res.status(500).send({
          messageCode: "ERR_BULK_MARK_FAILED",
          message: "Error processing bulk mark failed request",
          error: error.message
      });
  }
});

payinRouter.get("/admin/bulk-mark-failed/template", authenticateToken, async (req, res) => {
  try {
      const workbook = XLSX.utils.book_new();
      
      const sampleData = [
          { 'Unique ID': 'SAMPLE123' },
          { 'Unique ID': 'SAMPLE456' }
      ];
      
      // Create worksheet with sample data
      const worksheet = XLSX.utils.json_to_sheet(sampleData);
      worksheet['!cols'] = [{ wch: 20 }];
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
      
      const filename = 'bulk-mark-failed-template.xlsx';
      const filepath = path.join(__dirname, '../uploads/templates', filename);
      
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      XLSX.writeFile(workbook, filepath);
      
      res.download(filepath, filename, async (err) => {
          if (err) {
              console.error("Template download error:", err);
          }
          try {
              await fs.unlink(filepath);
          } catch (cleanupError) {
              console.error("Template cleanup error:", cleanupError);
          }
      });
  } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).send({
          messageCode: "ERR_GENERATE_TEMPLATE",
          message: "Error generating bulk mark failed template"
      });
  }
});

payinRouter.post("/admin/bulk-check-status", authenticateToken, async (req, res) => {
  try {
    console.log("enter--> ");
      upload.single('file')(req, res, async function(err) {
          if (err instanceof multer.MulterError) {
              return res.status(400).send({
                  messageCode: "UPLOAD_ERROR",
                  message: err.message
              });
          } else if (err) {
              return res.status(400).send({
                  messageCode: "INVALID_FILE",
                  message: err.message
              });
          }

          if (!req.file) {
              return res.status(400).send({
                  messageCode: "NO_FILE",
                  message: "Please upload an Excel file"
              });
          }

          const results = {
              processed: [],
              failed: [],
              skipped: []
          };

          try {
              // Read Excel file
              const workbook = XLSX.readFile(req.file.path);
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              const data = XLSX.utils.sheet_to_json(worksheet);

              if (data.length === 0) {
                  throw new Error('Excel file is empty');
              }

              if (!data[0].hasOwnProperty('Unique ID')) {
                  throw new Error('Excel file must contain a "Unique ID" column');
              }

              // Process transactions in batches
              const batchSize = 50;
              for (let i = 0; i < data.length; i += batchSize) {
                  const batch = data.slice(i, i + batchSize);
                  
                  await Promise.all(batch.map(async (row) => {
                      try {
                          const uniqueId = row['Unique ID']?.toString();
                          
                          if (!uniqueId) {
                              results.skipped.push({
                                  uniqueId: 'N/A',
                                  reason: 'Missing Unique ID'
                              });
                              return;
                          }
                          console.log("transaction Id--> ",uniqueId);
                          const transaction = await payinDao.getTransactionByUniqueId(uniqueId);
                          console.log("transaction Id--> ",transaction);

                         

                          if (!transaction) {
                              results.failed.push({
                                  uniqueId,
                                  reason: 'Transaction not found'
                              });
                              return;
                          }

                          

                          if (transaction.status !== 'PENDING') {
                              results.skipped.push({
                                  uniqueId,
                                  reason: `Transaction already ${transaction.status}`
                              });
                              return;
                          }

                          // Check status with vendor
                          const vendorResponse = await axios.post(
                              process.env.VENDOR_CHECK_STATUS_API,
                              {
                                  reseller_id: process.env.RESELLER_ID,
                                  reseller_pass: process.env.RESELLER_PASSWORD,
                                  uniqueid: transaction.transactionId,
                              }
                          );
                          console.log("vendorResponse--> ",vendorResponse);
                          if (!vendorResponse.data.Status) {
                              throw new Error('Vendor API error');
                          }






                          const statusData = vendorResponse.data.Data;
                          const amount = parseFloat(statusData.TxnAmount);
                          const newStatus = statusData.Status;

                          if (newStatus !== "PENDING" ) {
                              const updatedTransaction = await payinDao.processStatusChangeWithTransaction(
                                  transaction,
                                  newStatus === "APPROVED",
                                  amount,
                                  statusData.BankRRN
                              );

                              results.processed.push({
                                  uniqueId,
                                  previousStatus: transaction.status,
                                  currentStatus: updatedTransaction.status,
                                  amount: updatedTransaction.amount,
                                  bankRRN: updatedTransaction.vendorTransactionId
                              });
                          } else {
                              results.skipped.push({
                                  uniqueId,
                                  reason: 'Transaction still pending'
                              });
                          }
                      } catch (error) {
                          results.failed.push({
                              uniqueId: row['Unique ID']?.toString() || 'N/A',
                              reason: error.message || 'Processing error'
                          });
                      }
                  }));
              }

              // Generate summary report
              const summaryWorkbook = XLSX.utils.book_new();
              
              // Processed sheet
              const processedSheet = XLSX.utils.json_to_sheet(results.processed.map(item => ({
                  'Unique ID': item.uniqueId,
                  'Previous Status': item.previousStatus,
                  'Current Status': item.currentStatus,
                  'Amount': item.amount,
                  'Bank RRN': item.bankRRN || 'N/A'
              })));
              XLSX.utils.book_append_sheet(summaryWorkbook, processedSheet, 'Processed');

              // Failed sheet
              const failedSheet = XLSX.utils.json_to_sheet(results.failed.map(item => ({
                  'Unique ID': item.uniqueId,
                  'Reason': item.reason
              })));
              XLSX.utils.book_append_sheet(summaryWorkbook, failedSheet, 'Failed');

              // Skipped sheet
              const skippedSheet = XLSX.utils.json_to_sheet(results.skipped.map(item => ({
                  'Unique ID': item.uniqueId,
                  'Reason': item.reason
              })));
              XLSX.utils.book_append_sheet(summaryWorkbook, skippedSheet, 'Skipped');

              // Save summary file
              const summaryFilename = `bulk-status-check-summary-${Date.now()}.xlsx`;
              const summaryPath = path.join(__dirname, '../uploads/reports', summaryFilename);
              
              await fs.mkdir(path.dirname(summaryPath), { recursive: true });
              XLSX.writeFile(summaryWorkbook, summaryPath);

              res.download(summaryPath, summaryFilename, async (err) => {
                  if (err) {
                      console.error("Download error:", err);
                  }
                  try {
                      await fs.unlink(req.file.path);
                      await fs.unlink(summaryPath);
                  } catch (cleanupError) {
                      console.error("Cleanup error:", cleanupError);
                  }
              });

          } catch (error) {
              // Cleanup uploaded file in case of error
              try {
                  await fs.unlink(req.file.path);
              } catch (cleanupError) {
                  console.error("Cleanup error:", cleanupError);
              }
              
              throw error;
          }
      });
  } catch (error) {
      console.error("Error in bulk status check:", error);
      res.status(500).send({
          messageCode: "ERR_BULK_STATUS_CHECK",
          message: "Error processing bulk status check request",
          error: error.message
      });
  }
});

payinRouter.get("/admin/bulk-status-check/template", authenticateToken, async (req, res) => {
  try {
      const workbook = XLSX.utils.book_new();
      
      const sampleData = [
          { 'Unique ID': 'SAMPLE123' },
          { 'Unique ID': 'SAMPLE456' }
      ];
      
      const worksheet = XLSX.utils.json_to_sheet(sampleData);
      worksheet['!cols'] = [{ wch: 20 }];
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
      
      const filename = 'bulk-status-check-template.xlsx';
      const filepath = path.join(__dirname, '../uploads/templates', filename);
      
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      XLSX.writeFile(workbook, filepath);
      
      res.download(filepath, filename, async (err) => {
          if (err) {
              console.error("Template download error:", err);
          }
          try {
              await fs.unlink(filepath);
          } catch (cleanupError) {
              console.error("Template cleanup error:", cleanupError);
          }
      });
  } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).send({
          messageCode: "ERR_GENERATE_TEMPLATE",
          message: "Error generating bulk status check template"
      });
  }
});

module.exports = payinRouter;
