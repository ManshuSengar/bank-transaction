// callback-service/callback-process-controller.js
const express = require("express");
const callbackProcessRouter = express.Router();
const callbackProcessDao = require("./callback-process-dao");
const Logger = require("../logger/logger");
const log = new Logger("Callback-Process-Controller");
const Joi = require("joi");
const { authenticateToken } = require("../middleware/auth-token-validator");
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs').promises;
const { db, systemCallbackLogs } = require("./db/schema");
const { eq, and } = require("drizzle-orm");
const encryptionService = require("../encryption-service/encryption-dao");
const {payinTransactions}=require('../payin-service/db/schema');
const payinDao=require("../payin-service/payin-dao")
// Validation schema
const callbackSchema = Joi.object({
  data: Joi.string().required(), // Encrypted payload
});

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/bulk-callbacks');
    try {
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bulk-callbacks-' + uniqueSuffix + path.extname(file.originalname));
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
    fileSize: 15 * 1024 * 1024 // 15MB limit
  }
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
      transactionId
    } = req.query;

    const filters = {
      limit: Math.min(parseInt(limit) || 50, 100),
      offset: parseInt(offset) || 0,
    };

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

    if (transactionId) {
      filters.transactionId = transactionId.trim();
    }

    if (search && search.trim()) {
      filters.search = search.trim();
      filters.searchType = ["all", "transactionId", "orderId", "systemTransactionId"].includes(searchType)
        ? searchType
        : "all";
    }

    const systemLogs = await callbackProcessDao.getFilteredSystemCallbackLogs(filters);

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


callbackProcessRouter.post("/admin/bulk-callbacks", authenticateToken, async (req, res) => {
  try {
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

              // Get transaction details
              const [transaction] = await db
                .select()
                .from(payinTransactions)
                .where(eq(payinTransactions.transactionId, uniqueId))
                .limit(1);

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

              // Check for existing callback in system_callback_logs using text search
              const [existingCallback] = await db
                .select()
                .from(systemCallbackLogs)
                .where(sql`decrypted_data::TEXT LIKE ${`%${transaction.transactionId}%`}`)
                .limit(1);

              if (!existingCallback) {
                results.failed.push({
                  uniqueId,
                  reason: 'No callback data found'
                });
                return;
              }

              // Check if callback already processed for user
              const [existingUserCallback] = await db
                .select()
                .from(userCallbackLogs)
                .where(eq(userCallbackLogs.transactionId, transaction.transactionId))
                .limit(1);

              if (existingUserCallback) {
                results.skipped.push({
                  uniqueId,
                  reason: 'Callback already processed for user'
                });
                return;
              }

              // Check if transaction already settled
              const isSettled = await payinDao.isPayInTrxSettled(transaction.transactionId, transaction.id);

              // Process callback with settlement status
              const decryptedData = JSON.parse(existingCallback.decryptedData);
              const result = await callbackProcessDao.processUserCallback(decryptedData, isSettled >= 2);

              results.processed.push({
                uniqueId,
                transactionId: transaction.transactionId,
                status: result.transaction.status
              });

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
          'Transaction ID': item.transactionId,
          'Status': item.status
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

        // Save and send summary file
        const summaryFilename = `bulk-callbacks-summary-${Date.now()}.xlsx`;
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
    console.error("Error in bulk callback processing:", error);
    res.status(500).send({
      messageCode: "ERR_BULK_CALLBACKS",
      message: "Error processing bulk callbacks",
      error: error.message
    });
  }
});

module.exports = callbackProcessRouter;
