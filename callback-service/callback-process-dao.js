const Logger = require("../logger/logger");
const log = new Logger("Callback-Process-Dao");
const { db, systemCallbackLogs, userCallbackLogs } = require("./db/schema");
const { eq, and, gte, lte, desc, sql, or, like } = require("drizzle-orm");
const encryptionService = require("../encryption-service/encryption-dao");
const callbackDao = require("./callback-dao");
const uniqueIdDao = require("../unique-service/unique-id-dao");
const payinDao = require("../payin-service/payin-dao");
const walletDao = require("../wallet-service/wallet-dao");
const schemeDao = require("../scheme-service/scheme-dao");
const { payinTransactions } = require("../payin-service/db/schema");
const axios = require("axios");
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/user-callback-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: format.combine(
        format.timestamp(),
        format.json()
      )
    }),
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

class CallbackProcessDao {
  // Log system callback
  // In CallbackProcessDao class

  async logSystemCallback(encryptedData, payinTransactionId = null) {
    try {
      // Validate encrypted data
      if (!encryptedData) {
        throw new Error("Encrypted data is required");
      }

      // Decrypt the data
      let decryptedData = null;
      try {
        decryptedData = await encryptionService.decrypt(encryptedData);
      } catch (decryptError) {
        log.error("Decryption error:", decryptError);
        throw new Error("Failed to decrypt data");
      }

      // Insert into system callback logs
      const [systemLog] = await db
        .insert(systemCallbackLogs)
        .values({
          transactionId:decryptedData?.OrderId,
          encryptedData: encryptedData.toString(), // Ensure string format
          decryptedData: decryptedData ? JSON.stringify(decryptedData) : null,
          payinTransactionId,
          status: "RECEIVED",
        })
        .returning();
       console.log("systemLog--> ",systemLog);
      return {
        systemLog,
        decryptedData,
      };
    } catch (error) {
      log.error("Error in logSystemCallback:", error);
      throw error;
    }
  }

// In callback-process-dao.js

async processUserCallback(decryptedData) {
  const context = { 
    orderId: decryptedData.OrderId,
    userId: null,
    transactionId: null
  };

  try {
    logger.info('Starting user callback processing', context);

    return await db.transaction(async (tx) => {
      // Retrieve unique ID record
      logger.debug('Fetching unique ID record', { orderId: context.orderId });
      const uniqueIdRecord = await uniqueIdDao.getUniqueIdByGeneratedId(decryptedData.OrderId);
      
      if (!uniqueIdRecord) {
        const error = new Error("Unique ID not found");
        logger.error('Unique ID lookup failed', { 
          ...context,
          error: error.message,
          stack: error.stack 
        });
        error.statusCode = 404;
        error.messageCode = "UNIQUE_ID_NOT_FOUND";
        throw error;
      }

      context.userId = uniqueIdRecord.userId;
      context.transactionId = uniqueIdRecord.generatedUniqueId;

      logger.debug('Unique ID record found', { 
        ...context,
        originalUniqueId: uniqueIdRecord.originalUniqueId 
      });

      // Mark unique ID as used
      logger.debug('Marking unique ID as used', context);
      await uniqueIdDao.markUniqueIdAsUsed(uniqueIdRecord.id);

      // Fetch payin transaction
      logger.debug('Fetching payin transaction', {
        ...context,
        originalUniqueId: uniqueIdRecord.originalUniqueId
      });

      const [payinTransaction] = await tx
        .select()
        .from(payinTransactions)
        .where(
          and(
            eq(payinTransactions.uniqueId, uniqueIdRecord.originalUniqueId),
            eq(payinTransactions.status, "PENDING")
          )
        )
        .limit(1);

      if (!payinTransaction) {
        const error = new Error("Payin transaction not found");
        logger.error('Payin transaction lookup failed', {
          ...context,
          error: error.message,
          stack: error.stack
        });
        error.statusCode = 404;
        error.messageCode = "PAYIN_TRANSACTION_NOT_FOUND";
        throw error;
      }

      // Process transaction values
      const amount = parseFloat(decryptedData.amount);
      const status = decryptedData.status;
      const chargeAmount = parseFloat(payinTransaction.totalCharges);

      logger.debug('Processing transaction values', {
        ...context,
        rawAmount: decryptedData.amount,
        parsedAmount: amount,
        status,
        chargeAmount
      });

      // Update payin transaction status
      logger.info('Updating payin transaction status', {
        ...context,
        newStatus: status === "APPROVED" ? "SUCCESS" : "FAILED"
      });

      const [updatedTransaction] = await tx
        .update(payinTransactions)
        .set({
          status: status === "APPROVED" ? "SUCCESS" : "FAILED",
          vendorTransactionId: decryptedData?.BankRRN,
          errorMessage: status === "REJECTED" ? "Transaction Rejected" : null,
          updatedAt: new Date()
        })
        .where(eq(payinTransactions.id, payinTransaction.id))
        .returning();

      // Process wallet updates
      logger.debug('Fetching user wallets', context);
      const userWallets = await walletDao.getUserWallets(context.userId);
      
      const serviceWallet = userWallets.find(w => w?.type?.name === "SERVICE");
      const collectionWallet = userWallets.find(w => w?.type?.name === "COLLECTION");

      if (!serviceWallet || !collectionWallet) {
        const error = new Error("Required wallets not found");
        logger.error('Wallet validation failed', {
          ...context,
          serviceWalletExists: !!serviceWallet,
          collectionWalletExists: !!collectionWallet,
          error: error.message
        });
        error.statusCode = 400;
        error.messageCode = "WALLET_NOT_FOUND";
        throw error;
      }

      let walletUpdateLog = {};
      if (status === "APPROVED") {
        logger.info('Processing collection wallet credit', {
          ...context,
          walletId: collectionWallet.wallet.id,
          amount
        });

        await walletDao.updateWalletBalanceWithinTx(
          collectionWallet.wallet.id,
          amount,
          "CREDIT",
          `Payin Transaction Credit - ${payinTransaction.uniqueId}`,
          payinTransaction.transactionId,
          context.userId,
          "PAYIN",
          null,
          tx
        );
        walletUpdateLog.collectionCredit = amount;
      } else if (status === "REJECTED") {
        logger.info('Processing service wallet refund', {
          ...context,
          walletId: serviceWallet.wallet.id,
          chargeAmount
        });

        await walletDao.updateWalletBalanceWithinTx(
          serviceWallet.wallet.id,
          chargeAmount,
          "CREDIT",
          `Transaction Charge Refund - ${payinTransaction.uniqueId}`,
          payinTransaction.transactionId,
          context.userId,
          "PAYIN",
          null,
          tx
        );
        walletUpdateLog.serviceRefund = chargeAmount;
      }

      // Prepare callback data
      const modifiedPayload = {
        ...decryptedData,
        OrderId: uniqueIdRecord.originalUniqueId,
        txnid: uniqueIdRecord.generatedUniqueId,
      };

      logger.debug('Prepared modified payload', {
        ...context,
        modifiedPayload
      });

      // Process user callback
      logger.debug('Fetching user callback configurations', context);
      const userCallbackConfigs = await callbackDao.getUserCallbackConfigs(context.userId);
      
      if (!userCallbackConfigs.length) {
        logger.warn('No callback configurations found', context);
        return {
          transaction: updatedTransaction,
          userCallbackLog: null,
          walletOperations: walletUpdateLog
        };
      }

      const callbackConfig = userCallbackConfigs.find(config => config.status === "ACTIVE");
      if (!callbackConfig) {
        logger.warn('No active callback configuration found', context);
        return {
          transaction: updatedTransaction,
          userCallbackLog: null,
          walletOperations: walletUpdateLog
        };
      }

      logger.info('Initiating external callback', {
        ...context,
        callbackUrl: callbackConfig.callbackUrl
      });

      let callbackResponse = null;
      let isSuccessful = false;
      let errorMessage = null;
      const startTime = Date.now();

      try {
        const response = await axios.post(callbackConfig.callbackUrl, modifiedPayload);
        callbackResponse = response.data;
        isSuccessful = true;
        
        logger.info('Callback successful', {
          ...context,
          callbackUrl: callbackConfig.callbackUrl,
          durationMs: Date.now() - startTime,
          statusCode: response.status
        });
      } catch (callbackError) {
        errorMessage = callbackError.message;
        
        logger.error('Callback failed', {
          ...context,
          callbackUrl: callbackConfig.callbackUrl,
          durationMs: Date.now() - startTime,
          error: errorMessage,
          responseData: callbackError.response?.data,
          statusCode: callbackError.response?.status
        });
      }

      // Log callback result
      logger.debug('Recording user callback log', context);
      const [userCallbackLog] = await tx
        .insert(userCallbackLogs)
        .values({
          userId: context.userId,
          transactionId: context.transactionId,
          configId: callbackConfig.id,
          originalPayload: decryptedData,
          modifiedPayload,
          status: isSuccessful ? "COMPLETED" : "FAILED",
          isSuccessful,
          errorMessage,
          callbackUrl: callbackConfig.callbackUrl,
          callbackResponse: JSON.stringify(callbackResponse),
        })
        .returning();

      logger.info('User callback processing completed', {
        ...context,
        callbackStatus: isSuccessful ? "SUCCESS" : "FAILED"
      });

      return {
        transaction: updatedTransaction,
        userCallbackLog,
        walletOperations: walletUpdateLog
      };
    });
  } catch (error) {
    logger.error('User callback processing failed', {
      ...context,
      error: error.message,
      stack: error.stack,
      statusCode: error.statusCode || 500
    });
    throw error;
  }
}

async getFilteredSystemCallbackLogs(filters) {
  try {
    const conditions = [];

    const baseQuery = db
      .select({
        systemLog: systemCallbackLogs,
        payinTransaction: payinTransactions,
      })
      .from(systemCallbackLogs)
      .leftJoin(
        payinTransactions,
        eq(systemCallbackLogs.payinTransactionId, payinTransactions.id)
      );

    if (filters.startDate) {
      conditions.push(gte(systemCallbackLogs.createdAt, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(systemCallbackLogs.createdAt, filters.endDate));
    }

    if (filters.status) {
      conditions.push(eq(systemCallbackLogs.status, filters.status));
    }

    if (filters.userId) {
      conditions.push(eq(payinTransactions.userId, filters.userId));
    }

    if (filters.transactionId) {
      conditions.push(eq(systemCallbackLogs.transactionId, filters.transactionId));
    }

    if (filters.search && filters.search.trim()) {
      const searchTerm = filters.search.trim();
      const searchConditions = [];

      switch (filters.searchType) {
        case "transactionId":
          searchConditions.push(
            or(
              sql`CAST(${systemCallbackLogs.decryptedData}->>'txnid' AS TEXT) ILIKE ${`%${searchTerm}%`}`,
              sql`CAST(${systemCallbackLogs.decryptedData}->>'BankRRN' AS TEXT) ILIKE ${`%${searchTerm}%`}`,
              sql`CAST(${payinTransactions.uniqueId} AS TEXT) ILIKE ${`%${searchTerm}%`}`,
              sql`CAST(${payinTransactions.vendorTransactionId} AS TEXT) ILIKE ${`%${searchTerm}%`}`
            )
          );
          break;

        case "systemTransactionId":
          searchConditions.push(
            sql`CAST(${systemCallbackLogs.transactionId} AS TEXT) ILIKE ${`%${searchTerm}%`}`
          );
          break;

        case "orderId":
          searchConditions.push(
            sql`CAST(${systemCallbackLogs.decryptedData}->>'OrderId' AS TEXT) ILIKE ${`%${searchTerm}%`}`
          );
          break;

        default:
          searchConditions.push(
            or(
              sql`CAST(${systemCallbackLogs.decryptedData}->>'txnid' AS TEXT) ILIKE ${`%${searchTerm}%`}`,
              sql`CAST(${systemCallbackLogs.decryptedData}->>'OrderId' AS TEXT) ILIKE ${`%${searchTerm}%`}`,
              sql`CAST(${systemCallbackLogs.decryptedData}->>'BankRRN' AS TEXT) ILIKE ${`%${searchTerm}%`}`,
              sql`CAST(${payinTransactions.uniqueId} AS TEXT) ILIKE ${`%${searchTerm}%`}`,
              sql`CAST(${payinTransactions.vendorTransactionId} AS TEXT) ILIKE ${`%${searchTerm}%`}`,
              sql`CAST(${systemCallbackLogs.transactionId} AS TEXT) ILIKE ${`%${searchTerm}%`}`
            )
          );
      }

      if (searchConditions.length > 0) {
        conditions.push(or(...searchConditions));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ count }] = await db
      .select({
        count: sql`count(*)`,
      })
      .from(systemCallbackLogs)
      .leftJoin(
        payinTransactions,
        eq(systemCallbackLogs.payinTransactionId, payinTransactions.id)
      )
      .where(whereClause);

    const logs = await baseQuery
      .where(whereClause)
      .orderBy(desc(systemCallbackLogs.createdAt))
      .limit(filters.limit)
      .offset(filters.offset);

    return {
      total: parseInt(count),
      logs: logs.map((log) => {
        let decryptedData;
        try {
          decryptedData = typeof log.systemLog.decryptedData === "string"
            ? JSON.parse(log.systemLog.decryptedData)
            : log.systemLog.decryptedData;
        } catch (e) {
          decryptedData = {};
          console.error("Error parsing decryptedData:", e);
        }

        return {
          id: log.systemLog.id,
          decryptedData,
          status: log.systemLog.status,
          createdAt: log.systemLog.createdAt,
          payinTransactionId: log.systemLog.payinTransactionId,
          encryptedData: log.systemLog.encryptedData,
          transactionId: log.systemLog.transactionId || decryptedData?.txnid || decryptedData?.BankRRN || log.payinTransaction?.vendorTransactionId || "N/A",
          transactionDetails: log.payinTransaction
            ? {
                uniqueId: log.payinTransaction.uniqueId,
                status: log.payinTransaction.status,
                amount: log.payinTransaction.amount,
                userId: log.payinTransaction.userId,
                vendorTransactionId: log.payinTransaction.vendorTransactionId,
              }
            : null,
          orderId: decryptedData?.OrderId || "N/A",
          amount: decryptedData?.amount || log.payinTransaction?.amount || 0,
        };
      }),
    };
  } catch (error) {
    console.error("Error fetching filtered system callback logs:", error);
    log.error("Error fetching filtered system callback logs:", error);
    throw error;
  }
} 
  async getFilteredUserCallbackLogs(filters) {
    try {
        // Build base conditions array
        const conditions = [eq(userCallbackLogs.userId, filters.userId)];
        
        // Add date filters
        if (filters.startDate) {
            conditions.push(gte(userCallbackLogs.createdAt, filters.startDate));
        }

        if (filters.endDate) {
            conditions.push(lte(userCallbackLogs.createdAt, filters.endDate));
        }

        // Build base query with joins if needed
        const baseQuery = db
            .select({
                id: userCallbackLogs.id,
                transactionId: userCallbackLogs.transactionId,
                modifiedPayload: userCallbackLogs.modifiedPayload,
                status: userCallbackLogs.status,
                isSuccessful: userCallbackLogs.isSuccessful,
                errorMessage: userCallbackLogs.errorMessage,
                callbackUrl: userCallbackLogs.callbackUrl,
                callbackResponse: userCallbackLogs.callbackResponse,
                createdAt: userCallbackLogs.createdAt
            })
            .from(userCallbackLogs);

        // Get total count with conditions
        const [{ count }] = await db
            .select({ 
                count: sql`count(*)` 
            })
            .from(userCallbackLogs)
            .where(and(...conditions));

        // Get paginated results with conditions
        const logs = await baseQuery
            .where(and(...conditions))
            .orderBy(desc(userCallbackLogs.createdAt))
            .limit(filters.limit)
            .offset(filters.offset);

        // Transform and return results
        return {
            total: parseInt(count),
            logs: logs.map(log => {
                let modifiedPayload;
                try {
                    modifiedPayload = typeof log.modifiedPayload === 'string' 
                        ? JSON.parse(log.modifiedPayload)
                        : log.modifiedPayload;
                } catch (e) {
                    modifiedPayload = {};
                    console.error('Error parsing modifiedPayload:', e);
                }

                return {
                    id: log.id,
                    transactionId: log.transactionId,
                    status: log.status,
                    isSuccessful: log.isSuccessful,
                    callbackUrl: log.callbackUrl,
                    errorMessage: log.errorMessage,
                    callbackResponse: log.callbackResponse,
                    createdAt: log.createdAt,
                    // Include relevant fields from modifiedPayload
                    amount: modifiedPayload?.amount,
                    orderId: modifiedPayload?.OrderId,
                    bankRRN: modifiedPayload?.BankRRN
                };
            })
        };
    } catch (error) {
        console.error("Error fetching filtered user callback logs:", error);
        log.error("Error fetching filtered user callback logs:", error);
        throw error;
    }
}
}

module.exports = new CallbackProcessDao();
