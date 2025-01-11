const Logger = require("../logger/logger");
const log = new Logger("Payout-Dao");
const { db, payoutTransactions } = require("./db/schema");
const { eq, and, sql, desc } = require("drizzle-orm");
const encryptionService = require("../encryption-service/encryption-dao");
const schemeDao = require("../scheme-service/scheme-dao");
const apiConfigDao = require("../api-config-service/api-config-dao");
const walletDao = require("../wallet-service/wallet-dao");
const axios = require("axios");
const crypto = require("crypto");
const uniqueIdDao = require("../unique-service/unique-id-dao");
const schemeTransactionLogDao = require("../scheme-service/scheme-transaction-log-dao");
const callBackDao=require("../callback-service/callback-dao");


class PayoutDao {
  generatePayoutId() {
    return crypto.randomBytes(16).toString("hex");
  }
  async verifyAccount(userId, verificationData) {
    try {
      const apiConfig = await apiConfigDao.getDefaultApiConfig(2);
      if (!apiConfig) {
        throw {
          statusCode: 500,
          messageCode: "NO_API_CONFIG",
          message: "No API configuration found for Payout",
        };
      }

      const vendorPayload = {
        clientId: apiConfig.username,
        secretKey: apiConfig.password,
        number: verificationData.phoneNumber,
        accountNo: verificationData.accountNumber,
        ifscCode: verificationData.ifscCode,
        clientOrderId: verificationData.clientOrderId,
      };
  
      const response = await axios.post(
        `${apiConfig.baseUrl}/account-validate`,
        vendorPayload
      );
      const verificationId = this.generatePayoutId();
  
      const isVerified = response.data.statusCode === 1; // 1 means success
  
      // Save verification record with precise status
      const [verification] = await db
        .insert(accountVerifications)
        .values({
          id: verificationId,
          userId,
          accountNumber: verificationData.accountNumber,
          ifscCode: verificationData.ifscCode,
          phoneNumber: verificationData.phoneNumber,
          clientOrderId: verificationData.clientOrderId,
          orderId: response.data.orderId,
          status: isVerified ? "VERIFIED" : "FAILED", // Explicit status based on vendor response
          beneficiaryName: isVerified ? response.data.beneficiaryName : null,
          vendorResponse: response.data,
          ipAddress: verificationData.ipAddress,
        })
        .returning();
  
      return {
        verification,
        vendorResponse: {
          ...response.data,
          success: isVerified, // Ensure consistent success flag
        },
      };
    } catch (error) {
      log.error("Error verifying account:", error);
      throw error;
    }
  }

  async initiatePayout(userId, payoutData, userToken) {
    try {
      return await db.transaction(async (tx) => {
        const payoutId = this.generatePayoutId();
        const userSchemes = await schemeDao.getUserSchemes(userId, 2); // Product ID 2 for Payout
        if (!userSchemes.length) {
          throw {
            statusCode: 400,
            messageCode: "NO_PAYOUT_SCHEME",
            message: "No payout scheme assigned to user",
          };
        }
        const scheme = userSchemes[0];
        if (
          scheme.minTransactionLimit &&
          scheme.minTransactionLimit > payoutData.amount
        ) {
          throw {
            statusCode: 400,
            messageCode: "AMOUNT_BELOW_MIN_LIMIT",
            message: `Amount must be at least ${scheme.minTransactionLimit}`,
          };
        }
        if (
          scheme.maxTransactionLimit &&
          scheme.maxTransactionLimit < payoutData.amount
        ) {
          throw {
            statusCode: 400,
            messageCode: "AMOUNT_EXCEEDS_MAX_LIMIT",
            message: `Amount must not exceed ${scheme.maxTransactionLimit}`,
          };
        }

        const apiConfig = await apiConfigDao.getDefaultApiConfig(2);
        if (!apiConfig) {
          throw {
            statusCode: 500,
            messageCode: "NO_API_CONFIG",
            message: "No API configuration found for Payout",
          };
        }
        const chargeCalculation = await schemeDao.calculateCharges(
          payoutData.amount,
          scheme.id,
          2
        );

        const userWallets = await walletDao.getUserWallets(userId);
        const payoutWallet = userWallets.find((w) => w.type.name === "PAYOUT");

        const totalAmount =
          parseFloat(payoutData.amount) +
          parseFloat(chargeCalculation.charges.totalCharges);

        if (!payoutWallet || payoutWallet.wallet.balance < totalAmount) {
          throw {
            statusCode: 400,
            messageCode: "INSUFFICIENT_BALANCE",
            message: "Insufficient balance in payout wallet",
          };
        }

        const [transaction] = await tx
          .insert(payoutTransactions)
          .values({
            id: payoutId,
            userId,
            schemeId: scheme.id,
            apiConfigId: apiConfig.id,
            clientOrderId: payoutData.clientOrderId,
            vendorOrderId: payoutId,
            amount: payoutData.amount,
            transferMode: payoutData.transferMode,
            accountNumber: payoutData.accountNumber,
            ifscCode: payoutData.ifscCode,
            beneficiaryName: payoutData.beneficiaryName,
            phoneNumber: payoutData.phoneNumber,
            vpa: payoutData.vpa,
            baseAmount: payoutData.amount,
            chargeType: chargeCalculation.charges.chargeType,
            chargeValue: chargeCalculation.charges.chargeValue,
            gstPercentage: chargeCalculation.charges.gst.percentage,
            gstAmount: chargeCalculation.charges.gst.amount,
            totalCharges: chargeCalculation.charges.totalCharges,
            status: "INITIATED",
            ipAddress: payoutData.ipAddress,
            processedAt: new Date(),
          })
          .returning();

        await walletDao.updateWalletBalance(
          payoutWallet.wallet.id,
          totalAmount,
          "DEBIT",
          `Payout Transaction #${transaction.id}`,
          transaction.id,
          userId,
          "PAYOUT"
        );

        const vendorPayload = {
          clientId: process.env.PAYOUT_CLIENT_ID,
          secretKey: process.env.PAYOUT_SECRET_KEY,
          number: payoutData.phoneNumber,
          amount: payoutData.amount.toString(),
          transferMode: payoutData.transferMode,
          accountNo: payoutData.accountNumber,
          ifscCode: payoutData.ifscCode,
          beneficiaryName: payoutData.beneficiaryName,
          vpa: payoutData.vpa,
          clientOrderId: payoutId,
        };

        const vendorResponse = await axios.post(
          `${apiConfig.baseUrl}/api/api/api-module/payout/payout`,
          vendorPayload,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const payoutStatus = vendorResponse.data.statusCode === 1 
        ? "SUCCESS" 
        : (vendorResponse.data.statusCode === 0 ? "FAILED" : "PENDING");
        console.log("vendorResponse--> ",vendorResponse);

        // 9. Update Transaction with Vendor Response
        const [updatedTransaction] = await tx
        .update(payoutTransactions)
        .set({
          orderId: vendorResponse.data.orderId,
          status: payoutStatus,
          utrNumber: vendorResponse.data.utr,
          vendorResponse: vendorResponse.data,
          updatedAt: new Date(),
        })
        .where(eq(payoutTransactions.id, payoutId))
        .returning();

        return {
          transaction: {
            ...updatedTransaction,
            internalId: payoutId,
            clientOrderId: payoutData.clientOrderId,
          },
          vendorResponse: vendorResponse.data,
        };
      });
    } catch (error) {
      log.error("Error initiating payout:", error);
      throw error;
    }
  }

  async checkStatus(userId, clientOrderId, userToken) {
    try {
      const [transaction] = await db
        .select()
        .from(payoutTransactions)
        .where(
          and(
            eq(payoutTransactions.userId, userId),
            eq(payoutTransactions.clientOrderId, clientOrderId)
          )
        )
        .limit(1);

      if (!transaction) {
        throw {
          statusCode: 404,
          messageCode: "TRANSACTION_NOT_FOUND",
          message: "Transaction not found",
        };
      }

      // Get API config
      const apiConfig = await apiConfigDao.getDefaultApiConfig(2); // Product ID 2 for Payout
      if (!apiConfig) {
        throw {
          statusCode: 500,
          messageCode: "NO_API_CONFIG",
          message: "No API configuration found for Payout",
        };
      }

      // Make status check API call
      const vendorPayload = {
        clientId: apiConfig.username,
        secretKey: apiConfig.password,
        clientOrderId: clientOrderId,
      };

      const response = await axios.post(
        `${apiConfig.baseUrl}/status-check`,
        vendorPayload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      // Update transaction if status has changed
      if (
        response.data.statusCode !== this.getVendorStatusCode(transaction.status)
      ) {
        const newStatus = this.mapVendorStatus(response.data.statusCode);

        const [updatedTransaction] = await db
          .update(payoutTransactions)
          .set({
            status: newStatus,
            utrNumber: response.data.utr || transaction.utrNumber,
            vendorResponse: response.data,
            updatedAt: new Date(),
            completedAt: ["SUCCESS", "FAILED"].includes(newStatus)
              ? new Date()
              : null,
          })
          .where(eq(payoutTransactions.id, transaction.id))
          .returning();

        // Process refund if failed
        if (newStatus === "FAILED" && transaction.status !== "FAILED") {
          await this.processRefund(updatedTransaction);
        }

        return {
          transaction: updatedTransaction,
          vendorResponse: response.data,
        };
      }

      return {
        transaction,
        vendorResponse: response.data,
      };
    } catch (error) {
      console.log("error--> ",error);
      log.error("Error checking payout status:", error);
      throw error;
    }
  }

  async processCallback(encryptedData) {
    try {
      // Decrypt callback data
      const decryptedData = await encryptionService.decrypt(encryptedData);
  
      // Log raw callback
      const [systemLog] = await db
        .insert(systemCallbackLogs)
        .values({
          encryptedData,
          decryptedData,
          status: "RECEIVED",
          receivedAt: new Date()
        })
        .returning();
  
      // Find transaction using vendor order ID from callback
      const [transaction] = await db
        .select()
        .from(payoutTransactions)
        .where(eq(payoutTransactions.vendorOrderId, decryptedData.ClientOrderId))
        .limit(1);
  
      if (!transaction) {
        // Log error but don't throw to send 200 response to vendor
        log.error(`Transaction not found for vendor order ID: ${decryptedData.ClientOrderId}`);
        await db
          .update(systemCallbackLogs)
          .set({
            status: "FAILED",
            errorMessage: "Transaction not found",
            processedAt: new Date()
          })
          .where(eq(systemCallbackLogs.id, systemLog.id));
        return null;
      }
  
      // Update system log with transaction ID
      await db
        .update(systemCallbackLogs)
        .set({
          payoutTransactionId: transaction.id,
          status: "PROCESSING"
        })
        .where(eq(systemCallbackLogs.id, systemLog.id));
  
      // Map vendor status to internal status
      const newStatus = this.mapVendorStatus(decryptedData.Status);
  
      // Start transaction for status update and related operations
      return await db.transaction(async (tx) => {
        // Update transaction status
        const [updatedTransaction] = await tx
          .update(payoutTransactions)
          .set({
            status: newStatus,
            utrNumber: decryptedData.UTR,
            vendorResponse: decryptedData,
            updatedAt: new Date(),
            completedAt: ["SUCCESS", "FAILED"].includes(newStatus) ? new Date() : null,
          })
          .where(eq(payoutTransactions.id, transaction.id))
          .returning();
  
        // Log status change
        await tx
          .insert(payoutStatusLogs)
          .values({
            payoutTransactionId: transaction.id,
            oldStatus: transaction.status,
            newStatus,
            vendorResponse: decryptedData,
            source: "CALLBACK"
          });
  
        // Handle failed transactions
        if (newStatus === "FAILED" && transaction.status !== "FAILED") {
          await this.processRefund(updatedTransaction, tx);
        }
  
        // Prepare callback data for user with original client order ID
        const userCallbackData = {
          ...decryptedData,
          ClientOrderId: transaction.clientOrderId, // Replace with client's order ID
          TransactionId: transaction.id,
          Amount: transaction.amount,
          Status: newStatus,
          UTR: decryptedData.UTR || null,
          Message: decryptedData.Message || "",
          TransactionTime: decryptedData.TransactionTime || new Date().toISOString()
        };
  
        // Forward to user's callback URL
        const callbackResult = await this.forwardCallback(updatedTransaction, userCallbackData);
  
        // Update system log status
        await tx
          .update(systemCallbackLogs)
          .set({
            status: "COMPLETED",
            processedAt: new Date()
          })
          .where(eq(systemCallbackLogs.id, systemLog.id));
  
        return {
          systemLog,
          transaction: updatedTransaction,
          callbackResult
        };
      });
  
    } catch (error) {
      log.error("Error processing callback:", error);
      // Update system log with error
      if (systemLog) {
        await db
          .update(systemCallbackLogs)
          .set({
            status: "FAILED",
            errorMessage: error.message,
            processedAt: new Date()
          })
          .where(eq(systemCallbackLogs.id, systemLog.id))
          .catch(err => log.error("Error updating system log:", err));
      }
      throw error;
    }
  }

  async processRefund(transaction, tx = db) {
    try {
      // Get user's payout wallet
      const userWallets = await walletDao.getUserWallets(transaction.userId);
      const payoutWallet = userWallets.find((w) => w.type.name === "PAYOUT");
  
      if (!payoutWallet) {
        throw new Error("Payout wallet not found");
      }
  
      // Calculate total refund amount
      const totalAmount = parseFloat(transaction.amount) + parseFloat(transaction.totalCharges);
  
      // Refund to payout wallet
      await walletDao.updateWalletBalance(
        payoutWallet.wallet.id,
        totalAmount,
        "CREDIT",
        `Refund for failed payout #${transaction.clientOrderId}`,
        transaction.id,
        transaction.userId,
        "PAYOUT_REFUND",
        tx
      );
  
      // Log refund
      await tx
        .insert(payoutRefundLogs)
        .values({
          payoutTransactionId: transaction.id,
          amount: totalAmount,
          walletId: payoutWallet.wallet.id,
          status: "COMPLETED"
        });
  
    } catch (error) {
      log.error("Error processing refund:", error);
      throw error;
    }
  }

  async forwardCallback(transaction, callbackData) {
    try {
      const callbackConfigs = await callBackDao.getUserCallbackConfigs(
        transaction.userId
      );
      
      // If no callback configs, log and return null
      if (!callbackConfigs.length) {
        await db.insert(userCallbackLogs).values({
          transactionId: transaction.clientOrderId,
          userId: transaction.userId,
          status: "SKIPPED",
          isSuccessful: false,
          errorMessage: "No active callback configuration found"
        });
        return null;
      }
  
      const activeConfig = callbackConfigs.find((c) => c.status === "ACTIVE");
      
      // If no active config, log and return null
      if (!activeConfig) {
        await db.insert(userCallbackLogs).values({
          transactionId: transaction.clientOrderId,
          userId: transaction.userId,
          status: "SKIPPED",
          isSuccessful: false,
          errorMessage: "No active callback configuration"
        });
        return null;
      }
  
      // Send callback
      let response;
      try {
        response = await axios.post(activeConfig.callbackUrl, callbackData, {
          timeout: 10000, // 10 seconds timeout
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (axiosError) {
        // Log callback failure
        const errorLog = {
          transactionId: transaction.clientOrderId,
          userId: transaction.userId,
          configId: activeConfig.id,
          originalPayload: callbackData,
          status: "FAILED",
          isSuccessful: false,
          callbackUrl: activeConfig.callbackUrl,
          errorMessage: axiosError.message,
          errorDetails: {
            status: axiosError.response?.status,
            data: axiosError.response?.data
          }
        };
  
        await db.insert(userCallbackLogs).values(errorLog);
  
        // Throw to trigger potential retry mechanism
        throw axiosError;
      }
  
      // Log successful callback
      await db.insert(userCallbackLogs).values({
        transactionId: transaction.clientOrderId,
        userId: transaction.userId,
        configId: activeConfig.id,
        originalPayload: callbackData,
        status: "COMPLETED",
        isSuccessful: true,
        callbackUrl: activeConfig.callbackUrl,
        callbackResponse: JSON.stringify(response.data),
      });
  
      return response.data;
    } catch (error) {
      log.error("Unhandled error in forwardCallback:", error);
      throw error;
    }
  }

  mapVendorStatus(vendorStatus) {
    const statusMap = {
      0: "FAILED",
      1: "SUCCESS",
    };
    return statusMap[vendorStatus] || "PENDING";
  }

  getVendorStatusCode(status) {
    const statusMap = {
      SUCCESS: 1,
      PENDING: 2,
      FAILED: 0,
    };
    return statusMap[status] || 2;
  }

  async getFilteredTransactions({
    userId = null,
    startDate,
    endDate,
    status,
    search,
    minAmount,
    maxAmount,
    page = 1,
    limit = 10,
  }) {
    try {
      const conditions = [];

      if (userId) {
        conditions.push(eq(payoutTransactions.userId, userId));
      }

      if (startDate && endDate) {
        conditions.push(
          and(
            gte(payoutTransactions.createdAt, new Date(startDate)),
            lte(payoutTransactions.createdAt, new Date(endDate))
          )
        );
      }

      if (status) {
        conditions.push(eq(payoutTransactions.status, status));
      }

      if (minAmount) {
        conditions.push(gte(payoutTransactions.amount, minAmount));
      }

      if (maxAmount) {
        conditions.push(lte(payoutTransactions.amount, maxAmount));
      }

      if (search) {
        conditions.push(
          or(
            like(payoutTransactions.clientOrderId, `%${search}%`),
            like(payoutTransactions.orderId, `%${search}%`),
            like(payoutTransactions.utrNumber, `%${search}%`)
          )
        );
      }

      const offset = (page - 1) * limit;

      const [transactions, countResult] = await Promise.all([
        db
          .select()
          .from(payoutTransactions)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(payoutTransactions.createdAt)),

        db
          .select({
            count: sql`COUNT(*)`,
          })
          .from(payoutTransactions)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      const [summary] = await db
        .select({
          totalAmount: sql`SUM(amount)`,
          totalCharges: sql`SUM(total_charges)`,
          successCount: sql`COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END)`,
          failedCount: sql`COUNT(CASE WHEN status = 'FAILED' THEN 1 END)`,
          pendingCount: sql`COUNT(CASE WHEN status = 'PENDING' THEN 1 END)`,
        })
        .from(payoutTransactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        data: transactions,
        pagination: {
          page,
          limit,
          total: Number(countResult[0].count),
          pages: Math.ceil(Number(countResult[0].count) / limit),
        },
        summary: {
          totalAmount: Number(summary.totalAmount) || 0,
          totalCharges: Number(summary.totalCharges) || 0,
          successCount: Number(summary.successCount) || 0,
          failedCount: Number(summary.failedCount) || 0,
          pendingCount: Number(summary.pendingCount) || 0,
        },
      };
    } catch (error) {
      log.error("Error getting filtered transactions:", error);
      throw error;
    }
  }
}

module.exports = new PayoutDao();
