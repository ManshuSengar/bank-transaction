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
const callBackDao = require("../callback-service/callback-dao");
const {users} =require("../user-service/db/schema")
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
        const payoutStatus = this.mapVendorStatus(
          vendorResponse.data.statusCode,
          vendorResponse.data.status
        );

        console.log("vendorResponse--> ", vendorResponse);
        // 9. Update Transaction with Vendor Response
        const [updatedTransaction] = await tx
          .update(payoutTransactions)
          .set({
            orderId: vendorResponse.data.orderId,
            status: payoutStatus,
            utrNumber: vendorResponse.data.utr,
            vendorResponse: vendorResponse.data,
            updatedAt: new Date(),
            completedAt: ["SUCCESS", "FAILED", "REVERSED"].includes(
              payoutStatus
            )
              ? new Date()
              : null,
          })
          .where(eq(payoutTransactions.id, payoutId))
          .returning();

        if (
          ["FAILED", "REVERSED"].includes(payoutStatus) &&
          updatedTransaction.status !== "FAILED"
        ) {
          await this.processRefund(updatedTransaction, tx);
        }

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
            eq(payoutTransactions.id, clientOrderId)
          )
        )
        .limit(1);

        console.log("transaction--> ",transaction);

      if (!transaction) {
        throw {
          statusCode: 404,
          messageCode: "TRANSACTION_NOT_FOUND",
          message: "Transaction not found",
        };
      }

      // Get API config
      const apiConfig = await apiConfigDao.getDefaultApiConfig(2);
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

      // Map status using enhanced mapVendorStatus method
      const newStatus = this.mapVendorStatus(
        response.data.statusCode,
        response.data.status
      );

      // Only update if status has changed
      if (newStatus !== transaction.status) {
        const [updatedTransaction] = await db
          .update(payoutTransactions)
          .set({
            status: newStatus,
            utrNumber: response.data.utr || transaction.utrNumber,
            vendorResponse: response.data,
            updatedAt: new Date(),
            completedAt: ["SUCCESS", "FAILED", "REVERSED"].includes(newStatus)
              ? new Date()
              : null,
          })
          .where(eq(payoutTransactions.id, transaction.id))
          .returning();

        // Process refund for certain failure scenarios
        if (
          ["FAILED", "REVERSED"].includes(newStatus) &&
          transaction.status !== "FAILED"
        ) {
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
      console.log("error--> ", error);
      log.error("Error checking payout status:", error);
      throw error;
    }
  }
 

  mapVendorStatus(vendorStatusCode, statusParam = null) {
    switch (vendorStatusCode) {
      case 0:
        return "FAILED";
      case 1:
        if (statusParam) {
          switch (statusParam) {
            case 1:
              return "SUCCESS";
            case 0:
              return "FAILED";
            case 4:
              return "REVERSED";
            default:
              return "PENDING";
          }
        }
        return "SUCCESS";
      case 4:
        return "REVERSED";
      default:
        return "PENDING";
    }
  }

  getVendorStatusCode(status) {
    const statusMap = {
      SUCCESS: 1,
      PENDING: 2,
      FAILED: 0,
      REVERSED: 4,
    };
    return statusMap[status] || 2;
  }

  async getFilteredTransactions({
    userId,
    startDate,
    endDate,
    status,
    search,
    minAmount,
    maxAmount,
    page = 1,
    limit = 10
  }) {
    try {
      const conditions = [eq(payoutTransactions.userId, userId)];

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
            like(payoutTransactions.utrNumber, `%${search}%`),
            like(payoutTransactions.beneficiaryName, `%${search}%`),
            like(payoutTransactions.accountNumber, `%${search}%`)
          )
        );
      }

      const offset = (page - 1) * limit;

      const [transactions, countResult] = await Promise.all([
        db
          .select()
          .from(payoutTransactions)
          .where(and(...conditions))
          .limit(limit)
          .offset(offset)
          .orderBy(desc(payoutTransactions.createdAt)),

        db
          .select({ count: sql`count(*)` })
          .from(payoutTransactions)
          .where(and(...conditions))
      ]);

      const [summary] = await db
        .select({
          totalAmount: sql`SUM(amount)`,
          totalCharges: sql`SUM(total_charges)`,
          successCount: sql`COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END)`,
          failedCount: sql`COUNT(CASE WHEN status = 'FAILED' THEN 1 END)`,
          pendingCount: sql`COUNT(CASE WHEN status = 'PENDING' THEN 1 END)`,
          reversedCount: sql`COUNT(CASE WHEN status = 'REVERSED' THEN 1 END)`
        })
        .from(payoutTransactions)
        .where(and(...conditions));

      return {
        data: transactions,
        pagination: {
          page,
          limit,
          total: Number(countResult[0].count),
          pages: Math.ceil(Number(countResult[0].count) / limit)
        },
        summary: {
          totalAmount: Number(summary.totalAmount) || 0,
          totalCharges: Number(summary.totalCharges) || 0,
          successCount: Number(summary.successCount) || 0,
          failedCount: Number(summary.failedCount) || 0,
          pendingCount: Number(summary.pendingCount) || 0,
          reversedCount: Number(summary.reversedCount) || 0
        }
      };
    } catch (error) {
      log.error("Error getting filtered transactions:", error);
      throw error;
    }
  }

  async getAdminFilteredTransactions({
    startDate,
    endDate,
    status,
    search,
    minAmount,
    maxAmount,
    page = 1,
    limit = 10
  }) {
    try {
      const conditions = [];

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
            like(payoutTransactions.utrNumber, `%${search}%`),
            like(payoutTransactions.beneficiaryName, `%${search}%`),
            like(payoutTransactions.accountNumber, `%${search}%`),
            like(users.username, `%${search}%`),
            like(users.emailId, `%${search}%`),
            like(users.phoneNo, `%${search}%`)
          )
        );
      }

      const offset = (page - 1) * limit;

      const [transactions, countResult] = await Promise.all([
        db
          .select({
            transaction: payoutTransactions,
            user: {
              id: users.id,
              username: users.username,
              firstname: users.firstname,
              lastname: users.lastname,
              emailId: users.emailId,
              phoneNo: users.phoneNo
            }
          })
          .from(payoutTransactions)
          .leftJoin(users, eq(payoutTransactions.userId, users.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(payoutTransactions.createdAt)),

        db
          .select({ count: sql`count(*)` })
          .from(payoutTransactions)
          .leftJoin(users, eq(payoutTransactions.userId, users.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
      ]);

      const [summary] = await db
        .select({
          totalAmount: sql`SUM(amount)`,
          totalCharges: sql`SUM(total_charges)`,
          successCount: sql`COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END)`,
          failedCount: sql`COUNT(CASE WHEN status = 'FAILED' THEN 1 END)`,
          pendingCount: sql`COUNT(CASE WHEN status = 'PENDING' THEN 1 END)`,
          reversedCount: sql`COUNT(CASE WHEN status = 'REVERSED' THEN 1 END)`
        })
        .from(payoutTransactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        data: transactions.map(t => ({
          ...t.transaction,
          user: t.user
        })),
        pagination: {
          page,
          limit,
          total: Number(countResult[0].count),
          pages: Math.ceil(Number(countResult[0].count) / limit)
        },
        summary: {
          totalAmount: Number(summary.totalAmount) || 0,
          totalCharges: Number(summary.totalCharges) || 0,
          successCount: Number(summary.successCount) || 0,
          failedCount: Number(summary.failedCount) || 0,
          pendingCount: Number(summary.pendingCount) || 0,
          reversedCount: Number(summary.reversedCount) || 0
        }
      };
    } catch (error) {
      log.error("Error getting admin filtered transactions:", error);
      throw error;
    }
  }

  async getTransactionByClientOrderId(clientOrderId) {
    try {
      const [transaction] = await db
        .select()
        .from(payoutTransactions)
        .where(eq(payoutTransactions.id, clientOrderId))
        .limit(1);

      return transaction;
    } catch (error) {
      log.error("Error getting transaction by client order ID:", error);
      throw error;
    }
  }

  async checkStatusWithVendor(transaction) {
    try {
      const apiConfig = await apiConfigDao.getDefaultApiConfig(2); // Product ID 2 for Payout
      if (!apiConfig) {
        throw new Error("No API configuration found for Payout");
      }
      console.log("newStatus11--> ",transaction);
      const response = await axios.post(
        `${apiConfig.baseUrl}/api/api/api-module/payout/status-check`,
        {
          clientId: process.env.PAYOUT_CLIENT_ID,
          secretKey: process.env.PAYOUT_SECRET_KEY,
          clientOrderId: transaction.id
        },
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
      console.log("newStatus11--> ",response.data);
      const newStatus = this.mapVendorStatus(response.data);
      let description = this.getStatusDescription(transaction.status, newStatus);
      console.log("newStatus--> ",newStatus);
      if (newStatus !== transaction.status) {
        await this.updateTransactionStatus(
          transaction.id,
          newStatus,
          response.data.utr,
          response.data
        );

        if (["FAILED", "REVERSED"].includes(newStatus) && transaction.status !== "FAILED") {
          await this.processRefund(transaction);
        }
      }

      return {
        status: newStatus,
        utrNumber: response.data.utr || transaction.utrNumber,
        description
      };
    } catch (error) {
      console.log("error--> ",error);
      log.error("Error checking status with vendor:", error);
      throw error;
    }
  }

  async processCallback(callbackData) {
    try {
      // Log raw callback
      const [systemLog] = await db
        .insert(systemCallbackLogs)
        .values({
          callbackData: callbackData,
          status: "RECEIVED",
        })
        .returning();

      const transaction = await this.getTransactionByClientOrderId(callbackData.ClientOrderId);
      if (!transaction) {
        await this.updateSystemLog(systemLog.id, "FAILED", "Transaction not found");
        log.error(`Transaction not found for ClientOrderId: ${callbackData.ClientOrderId}`);
        return null;
      }

      await this.updateSystemLog(systemLog.id, "PROCESSING", null, transaction.id);

      // Map vendor status codes to internal status
      const statusCode = parseInt(callbackData.StatusCode);
      const statusNum = parseInt(callbackData.Status);
      const newStatus = this.mapVendorStatus({ 
        statusCode: statusCode, 
        status: statusNum 
      });

      return await db.transaction(async (tx) => {
        // Update transaction status
        const updatedTransaction = await this.updateTransactionStatus(
          transaction.id,
          newStatus,
          callbackData.UTR,  // Use UTR from callback
          {
            orderId: callbackData.OrderId,
            amount: parseFloat(callbackData.Amount),
            paymentMode: callbackData.PaymentMode,
            transactionDate: callbackData.Date,
            status: newStatus,
            statusCode: statusCode,
            checksum: callbackData.Checksum,
            rawResponse: callbackData
          },
          tx
        );

        // Process refund if needed
        if (["FAILED", "REVERSED"].includes(newStatus) && transaction.status !== "FAILED") {
          await this.processRefund(transaction, tx);
        }

        // Format user callback data
        const userCallbackData = {
          statusCode: statusCode,
          message: callbackData.Message,
          clientOrderId: callbackData.ClientOrderId,
          orderId: callbackData.OrderId,
          amount: callbackData.Amount,
          paymentMode: callbackData.PaymentMode,
          status: newStatus,
          utrNumber: callbackData.UTR,
          transactionDate: callbackData.Date,
          rawStatus: statusNum
        };

        await this.forwardCallback(updatedTransaction, userCallbackData);
        await this.updateSystemLog(systemLog.id, "COMPLETED");

        return {
          systemLog,
          transaction: updatedTransaction
        };
      });
    } catch (error) {
      log.error("Error processing callback:", error);
      if (systemLog) {
        await this.updateSystemLog(systemLog.id, "FAILED", error.message);
      }
      throw error;
    }
  }

  async updateTransactionStatus(transactionId, status, utrNumber, vendorResponse, tx = db) {
    const [updatedTransaction] = await tx
      .update(payoutTransactions)
      .set({
        status,
        utrNumber: utrNumber || null,
        vendorResponse,
        updatedAt: new Date(),
        completedAt: ["SUCCESS", "FAILED", "REVERSED"].includes(status)
          ? new Date()
          : null
      })
      .where(eq(payoutTransactions.id, transactionId))
      .returning();

    return updatedTransaction;
  }

  async updateSystemLog(logId, status, errorMessage = null, transactionId = null) {
    await db
      .update(systemCallbackLogs)
      .set({
        status,
        errorMessage,
        payoutTransactionId: transactionId,
        updatedAt: new Date()
      })
      .where(eq(systemCallbackLogs.id, logId));
  }

  async processRefund(transaction, tx = db) {
    try {
      const userWallets = await walletDao.getUserWallets(transaction.userId);
      const payoutWallet = userWallets.find(w => w.type.name === "PAYOUT");

      if (!payoutWallet) {
        throw new Error("Payout wallet not found");
      }

      const totalAmount = parseFloat(transaction.amount) + parseFloat(transaction.totalCharges);

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
    } catch (error) {
      log.error("Error processing refund:", error);
      throw error;
    }
  }

  async forwardCallback(transaction, callbackData) {
    try {
      const callbackConfigs = await callbackDao.getUserCallbackConfigs(transaction.userId);
      const activeConfig = callbackConfigs.find(c => c.status === "ACTIVE");

      if (!activeConfig) {
        return await this.logCallbackSkipped(transaction.clientOrderId, transaction.userId);
      }

      try {
        const response = await axios.post(activeConfig.callbackUrl, callbackData, {
          timeout: 10000,
          headers: { "Content-Type": "application/json" }
        });

        await this.logCallbackSuccess(
          transaction.clientOrderId,
          transaction.userId,
          activeConfig.id,
          callbackData,
          response.data
        );

        return response.data;
      } catch (error) {
        await this.logCallbackFailure(
          transaction.clientOrderId,
          transaction.userId,
          activeConfig.id,
          callbackData,
          error
        );
        throw error;
      }
    } catch (error) {
      log.error("Error forwarding callback:", error);
      throw error;
    }
  }

  async logCallbackSkipped(transactionId, userId) {
    await db.insert(userCallbackLogs).values({
      transactionId,
      userId,
      status: "SKIPPED",
      isSuccessful: false,
      errorMessage: "No active callback configuration"
    });
    return null;
  }

  async logCallbackSuccess(transactionId, userId, configId, payload, response) {
    await db.insert(userCallbackLogs).values({
      transactionId,
      userId,
      configId,
      originalPayload: payload,
      status: "COMPLETED",
      isSuccessful: true,
      callbackResponse: JSON.stringify(response)
    });
  }

  async logCallbackFailure(transactionId, userId, configId, payload, error) {
    await db.insert(userCallbackLogs).values({
      transactionId,
      userId,
      configId,
      originalPayload: payload,
      status: "FAILED",
      isSuccessful: false,
      errorMessage: error.message
    });
  }

  getStatusDescription(oldStatus, newStatus) {
    if (oldStatus === newStatus) {
      return "No status change";
    }

    const descriptions = {
      SUCCESS: "Transaction completed successfully - Amount transferred to beneficiary",
      FAILED: "Transaction failed - Amount will be refunded",
      REVERSED: "Transaction reversed - Amount will be refunded",
      PENDING: "Transaction is being processed"
    };

    return `Status changed from ${oldStatus} to ${newStatus}. ${descriptions[newStatus]}`;
  }

  async checkVendorBalance() {
    try {
        const apiConfig = await apiConfigDao.getDefaultApiConfig(2); 
        if (!apiConfig) {
            throw new Error("No API configuration found for Payout");
        }

        const response = await axios.post(
            `${apiConfig.baseUrl}/api/api/api-module/payout/balance`,
            {
                clientId: process.env.PAYOUT_CLIENT_ID,
                secretKey: process.env.PAYOUT_SECRET_KEY
            },
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        if (response.data.statusCode !== 1) {
            throw new Error(response.data.message || "Failed to fetch vendor balance");
        }

        return response.data.balance;
    } catch (error) {
        log.error("Error checking vendor balance:", error);
        throw error;
    }
}
}

module.exports = new PayoutDao();
