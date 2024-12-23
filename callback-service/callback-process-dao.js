const Logger = require("../logger/logger");
const log = new Logger("Callback-Process-Dao");
const { db, systemCallbackLogs, userCallbackLogs } = require("./db/schema");
const { eq, and } = require("drizzle-orm");
const encryptionService = require("../encryption-service/encryption-dao");
const callbackDao = require("./callback-dao");
const uniqueIdDao = require("../unique-service/unique-id-dao");
const payinDao = require("../payin-service/payin-dao");
const walletDao = require("../wallet-service/wallet-dao");
const schemeDao = require("../scheme-service/scheme-dao");
const { payinTransactions } = require("../payin-service/db/schema");

class CallbackProcessDao {
  // Log system callback
  async logSystemCallback(encryptedData, payinTransactionId = null) {
    try {
      const decryptedData = await encryptionService.decrypt(encryptedData);
      const [systemLog] = await db
        .insert(systemCallbackLogs)
        .values({
          encryptedData,
          decryptedData,
          payinTransactionId,
          status: "RECEIVED",
        })
        .returning();

      return { systemLog, decryptedData };
    } catch (error) {
      log.error("Error processing system callback:", error);
      throw error;
    }
  }

  async processUserCallback(decryptedData) {
    try {
      return await db.transaction(async (tx) => {
        // 1. Find the unique ID record
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
            payinTransaction.id,
            userId
          );
        } else if (status === "REJECTED") {
          // Refund charges to service wallet
          await walletDao.updateWalletBalance(
            serviceWallet.wallet.id,
            chargeAmount,
            "CREDIT",
            `Payin Transaction Charge Refund - ${payinTransaction.uniqueId}`,
            payinTransaction.id,
            userId
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
          errorMessage = callbackError.message;
          log.error("Callback failed:", callbackError);
        }

        // 12. Log user callback
        const [userCallbackLog] = await tx
          .insert(userCallbackLogs)
          .values({
            userId,
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
      log.error("Error processing user callback:", error);
      throw error;
    }
  }

  async getFilteredSystemCallbackLogs(filters) {
    try {
      let query = db
        .select({
          systemLog: systemCallbackLogs,
          payinTransaction: payinTransactions,
        })
        .from(systemCallbackLogs)
        .leftJoin(
          payinTransactions,
          eq(systemCallbackLogs.payinTransactionId, payinTransactions.id)
        );

      if (filters.userId) {
        query = query.where(eq(payinTransactions.userId, filters.userId));
      }

      if (filters.startDate) {
        query = query.where(
          gte(systemCallbackLogs.createdAt, filters.startDate)
        );
      }

      if (filters.endDate) {
        query = query.where(lte(systemCallbackLogs.createdAt, filters.endDate));
      }

      if (filters.status) {
        query = query.where(eq(systemCallbackLogs.status, filters.status));
      }

      const countQuery = query.clone();
      const [{ count }] = await countQuery.select({ count: sql`count(*)` });

      query = query
        .orderBy(desc(systemCallbackLogs.createdAt))
        .limit(filters.limit)
        .offset(filters.offset);

      const systemLogs = await query;

      return {
        total: parseInt(count),
        logs: systemLogs.map((log) => ({
          id: log.systemLog.id,
          decryptedData: log.systemLog.decryptedData,
          status: log.systemLog.status,
          createdAt: log.systemLog.createdAt,
          payinTransactionId: log.systemLog.payinTransactionId,
          transactionDetails: log.payinTransaction
            ? {
                uniqueId: log.payinTransaction.uniqueId,
                status: log.payinTransaction.status,
                amount: log.payinTransaction.amount,
                userId: log.payinTransaction.userId,
              }
            : null,
        })),
      };
    } catch (error) {
      log.error("Error fetching filtered system callback logs:", error);
      throw error;
    }
  }


async getFilteredUserCallbackLogs(filters) {
    try {
        let query = db
            .select()
            .from(userCallbackLogs)
            .where(eq(userCallbackLogs.userId, filters.userId));

        // Apply date filters
        if (filters.startDate) {
            query = query.where(gte(userCallbackLogs.createdAt, filters.startDate));
        }

        if (filters.endDate) {
            query = query.where(lte(userCallbackLogs.createdAt, filters.endDate));
        }

        // Get total count for pagination
        const countQuery = query.clone();
        const [{ count }] = await countQuery
            .select({ count: sql`count(*)` });

        // Apply pagination
        query = query
            .orderBy(desc(userCallbackLogs.createdAt))
            .limit(filters.limit)
            .offset(filters.offset);

        const logs = await query;

        return {
            total: parseInt(count),
            logs: logs.map(log => ({
                id: log.id,
                configId: log.configId,
                originalPayload: log.originalPayload,
                modifiedPayload: log.modifiedPayload,
                status: log.status,
                isSuccessful: log.isSuccessful,
                errorMessage: log.errorMessage,
                callbackUrl: log.callbackUrl,
                callbackResponse: log.callbackResponse,
                createdAt: log.createdAt
            }))
        };
    } catch (error) {
        log.error('Error fetching filtered user callback logs:', error);
        throw error;
    }
}

}

module.exports = new CallbackProcessDao();
