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
          encryptedData: encryptedData.toString(), // Ensure string format
          decryptedData: decryptedData ? JSON.stringify(decryptedData) : null,
          payinTransactionId,
          status: "RECEIVED",
        })
        .returning();

      return {
        systemLog,
        decryptedData,
      };
    } catch (error) {
      log.error("Error in logSystemCallback:", error);
      throw error;
    }
  }

  async processUserCallback(decryptedData) {
    try {
      return await db.transaction(async (tx) => {
        const uniqueIdRecord = await uniqueIdDao.getUniqueIdByGeneratedId(
          decryptedData.OrderId
        );

        if (!uniqueIdRecord) {
          throw {
            statusCode: 404,
            messageCode: "UNIQUE_ID_NOT_FOUND",
            message: "Unique ID not found",
          };
        }
        await uniqueIdDao.markUniqueIdAsUsed(uniqueIdRecord.id);
        // 2. Find the original payin transaction
        const [payinTransaction] = await tx
          .select()
          .from(payinTransactions)
          .where(
            eq(payinTransactions.uniqueId, uniqueIdRecord.originalUniqueId)
          )
          .limit(1);

        if (!payinTransaction) {
          throw {
            statusCode: 404,
            messageCode: "PAYIN_TRANSACTION_NOT_FOUND",
            message: "Original payin transaction not found",
          };
        }

        // 3. Prepare variables
        const userId = uniqueIdRecord.userId;
        const amount = parseFloat(decryptedData.amount);
        const status = decryptedData.status;
        const chargeAmount = parseFloat(payinTransaction.totalCharges);

        // 4. Get user's wallets
        const userWallets = await walletDao.getUserWallets(userId);
        const serviceWallet = userWallets.find(
          (w) => w.type.name === "SERVICE"
        );
        const collectionWallet = userWallets.find(
          (w) => w.type.name === "COLLECTION"
        );

        if (!serviceWallet || !collectionWallet) {
          throw {
            statusCode: 400,
            messageCode: "WALLET_NOT_FOUND",
            message: "Service or Collection wallet not found",
          };
        }

        // 5. Process based on transaction status
        if (status === "APPROVED") {
          // Credit amount to collection wallet
          await walletDao.updateWalletBalance(
            collectionWallet.wallet.id,
            amount,
            "CREDIT",
            `Payin Transaction Credit - ${payinTransaction.uniqueId}`,
            payinTransaction.transactionId,
            userId,
            "PAYIN"
          );
        } else if (status === "REJECTED") {
          // Refund charges to service wallet
          await walletDao.updateWalletBalance(
            serviceWallet.wallet.id,
            chargeAmount,
            "CREDIT",
            `Payin Transaction Charge Refund - ${payinTransaction.uniqueId}`,
            payinTransaction.transactionId,
            userId,
            "PAYIN"
          );
        }

        // 6. Update payin transaction status
        const [updatedTransaction] = await tx
          .update(payinTransactions)
          .set({
            status: status === "APPROVED" ? "SUCCESS" : "FAILED",
            vendorTransactionId: decryptedData.BankRRN,
            errorMessage: status === "REJECTED" ? "Transaction Rejected" : null,
          })
          .where(eq(payinTransactions.id, payinTransaction.id))
          .returning();

        // 7. Modify payload with original unique ID
        const modifiedPayload = {
          ...decryptedData,
          OrderId: uniqueIdRecord.originalUniqueId,
          txnid: uniqueIdRecord.generatedUniqueId,
        };

        // 8. Get user's callback configurations
        const userCallbackConfigs = await callbackDao.getUserCallbackConfigs(
          userId
        );

        // 9. If no callback configs, skip
        if (!userCallbackConfigs.length) {
          log.warn(`No callback configurations for user ${userId}`);
          return null;
        }

        // 10. Use the first active callback configuration
        const callbackConfig = userCallbackConfigs.find(
          (config) => config.status === "ACTIVE"
        );

        if (!callbackConfig) {
          log.warn(`No active callback configuration for user ${userId}`);
          return null;
        }

        // 11. Send callback
        let callbackResponse = null;
        let isSuccessful = false;
        let errorMessage = null;

        try {
          const response = await axios.post(
            callbackConfig.callbackUrl,
            modifiedPayload
          );
          callbackResponse = JSON.stringify(response.data);
          isSuccessful = true;
        } catch (callbackError) {
          console.log("callbackError--> ", callbackError);
          errorMessage = callbackError.message;
          log.error("Callback failed:", callbackError);
        }

        // 12. Log user callback
        const [userCallbackLog] = await tx
          .insert(userCallbackLogs)
          .values({
            userId,
            transactionId: uniqueIdRecord.generatedUniqueId,
            configId: callbackConfig.id,
            originalPayload: decryptedData,
            modifiedPayload,
            status: isSuccessful ? "COMPLETED" : "FAILED",
            isSuccessful,
            errorMessage,
            callbackUrl: callbackConfig.callbackUrl,
            callbackResponse,
          })
          .returning();

        return {
          transaction: updatedTransaction,
          userCallbackLog,
          walletOperations: {
            collectionWalletCredit: status === "APPROVED" ? amount : null,
            serviceWalletRefund: status === "REJECTED" ? chargeAmount : null,
          },
        };
      });
    } catch (error) {
      console.log("error last--> ", error);
      log.error("Error processing user callback:", error);
      throw error;
    }
  }

  async getFilteredSystemCallbackLogs(filters) {
    try {
      // Initialize conditions array
      const conditions = [];

      // Base query with joins
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

      // Add date filters
      if (filters.startDate) {
        conditions.push(gte(systemCallbackLogs.createdAt, filters.startDate));
      }

      if (filters.endDate) {
        conditions.push(lte(systemCallbackLogs.createdAt, filters.endDate));
      }

      // Add status filter
      if (filters.status) {
        conditions.push(eq(systemCallbackLogs.status, filters.status));
      }

      // Add user ID filter
      if (filters.userId) {
        conditions.push(eq(payinTransactions.userId, filters.userId));
      }

      // Add search conditions only if search term is not empty
      if (filters.search && filters.search.trim()) {
        const searchTerm = filters.search.trim();
        const searchConditions = [];

        switch (filters.searchType) {
          case "transactionId":
            searchConditions.push(
              or(
                sql`CAST(${
                  systemCallbackLogs.decryptedData
                }->>'txnid' AS TEXT) ILIKE ${`%${searchTerm}%`}`,
                sql`CAST(${
                  systemCallbackLogs.decryptedData
                }->>'BankRRN' AS TEXT) ILIKE ${`%${searchTerm}%`}`,
                sql`CAST(${
                  payinTransactions.uniqueId
                } AS TEXT) ILIKE ${`%${searchTerm}%`}`,
                sql`CAST(${
                  payinTransactions.vendorTransactionId
                } AS TEXT) ILIKE ${`%${searchTerm}%`}`
              )
            );
            break;

          case "orderId":
            searchConditions.push(
              sql`CAST(${
                systemCallbackLogs.decryptedData
              }->>'OrderId' AS TEXT) ILIKE ${`%${searchTerm}%`}`
            );
            break;

          default: // 'all'
            searchConditions.push(
              or(
                sql`CAST(${
                  systemCallbackLogs.decryptedData
                }->>'txnid' AS TEXT) ILIKE ${`%${searchTerm}%`}`,
                sql`CAST(${
                  systemCallbackLogs.decryptedData
                }->>'OrderId' AS TEXT) ILIKE ${`%${searchTerm}%`}`,
                sql`CAST(${
                  systemCallbackLogs.decryptedData
                }->>'BankRRN' AS TEXT) ILIKE ${`%${searchTerm}%`}`,
                sql`CAST(${
                  payinTransactions.uniqueId
                } AS TEXT) ILIKE ${`%${searchTerm}%`}`,
                sql`CAST(${
                  payinTransactions.vendorTransactionId
                } AS TEXT) ILIKE ${`%${searchTerm}%`}`
              )
            );
        }

        if (searchConditions.length > 0) {
          conditions.push(or(...searchConditions));
        }
      }

      // Build the where clause only if there are conditions
      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count with conditions
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

      // Get paginated results with conditions
      const logs = await baseQuery
        .where(whereClause)
        .orderBy(desc(systemCallbackLogs.createdAt))
        .limit(filters.limit)
        .offset(filters.offset);

      // Transform and return results
      return {
        total: parseInt(count),
        logs: logs.map((log) => {
          let decryptedData;
          try {
            decryptedData =
              typeof log.systemLog.decryptedData === "string"
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
            transactionDetails: log.payinTransaction
              ? {
                  uniqueId: log.payinTransaction.uniqueId,
                  status: log.payinTransaction.status,
                  amount: log.payinTransaction.amount,
                  userId: log.payinTransaction.userId,
                  vendorTransactionId: log.payinTransaction.vendorTransactionId,
                }
              : null,
            transactionId:
              decryptedData?.txnid ||
              decryptedData?.BankRRN ||
              log.payinTransaction?.vendorTransactionId ||
              "N/A",
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
