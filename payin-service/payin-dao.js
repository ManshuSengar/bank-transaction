// payin-service/payin-dao.js
const Logger = require("../logger/logger");
const log = new Logger("Payin-Dao");
const { db, payinTransactions, vendorResponseLogs } = require("./db/schema");
const { eq, and, sql, desc, or, like, gte, lte } = require("drizzle-orm");
const encryptionService = require("../encryption-service/encryption-dao");
const schemeDao = require("../scheme-service/scheme-dao");
const apiConfigDao = require("../api-config-service/api-config-dao");
const walletDao = require("../wallet-service/wallet-dao");
const axios = require("axios");
const crypto = require("crypto");
const uniqueIdDao = require("../unique-service/unique-id-dao");
const schemeTransactionLogDao = require("../scheme-service/scheme-transaction-log-dao");
const { users } = require("../user-service/db/schema");
const IndianNameEmailGenerator = require("../payin-service/utlis");
const nameEmailGenerator = new IndianNameEmailGenerator();

class PayinDao {
  async logVendorResponseError(params) {
    try {
      const [errorLog] = await db
        .insert(vendorResponseLogs)
        .values({
          userId: params.userId,
          uniqueId: params.uniqueId,
          transactionId: params.transactionId,
          requestPayload: params.requestPayload,
          vendorResponse: params.vendorResponse,
          errorType: params.errorType,
          errorDetails: {
            error: params.errorMessage,
            timestamp: new Date(),
            additionalInfo: params.additionalInfo || {},
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return errorLog;
    } catch (error) {
      log.error("Error logging vendor response:", error);
      throw error;
    }
  }

  async generateQR(userId, amount, originalUniqueId = null) {
    try {
      return await db.transaction(async (tx) => {
        // 1. Get User's Default Payin Scheme

        if (originalUniqueId) {
          const existingUniqueId = await uniqueIdDao.checkOriginalUniqueId(
            userId,
            originalUniqueId
          );
          if (existingUniqueId) {
            throw {
              statusCode: 400,
              messageCode: "DUPLICATE_UNIQUE_ID",
              message: "Unique ID already used for this user",
            };
          }
        } else {
          throw {
            statusCode: 400,
            messageCode: "UNIQUE_ID_EXISTED",
            message: "Pass Unique ID",
          };
        }

        const finalOriginalUniqueId = originalUniqueId;

        const userSchemes = await schemeDao.getUserSchemes(userId, 1);
        console.log("userSchemes--> ", userSchemes);
        // Product ID 1 for Payin
        if (!userSchemes.length) {
          throw {
            statusCode: 400,
            messageCode: "NO_PAYIN_SCHEME",
            message: "No payin scheme assigned to user",
          };
        }
        const scheme = userSchemes[0];

        // 2. Validate Scheme Limits
        if (
          scheme.minTransactionLimit &&
          +amount < +scheme.minTransactionLimit
        ) {
          throw {
            statusCode: 400,
            messageCode: "AMOUNT_BELOW_MIN_LIMIT",
            message: `Amount must be at least ${scheme.minTransactionLimit}`,
          };
        }
        console.log("scheme--> ", scheme, "--> ", amount);
        if (
          scheme.maxTransactionLimit &&
          +amount > +scheme.maxTransactionLimit
        ) {
          throw {
            statusCode: 400,
            messageCode: "AMOUNT_EXCEEDS_MAX_LIMIT",
            message: `Amount must not exceed ${scheme.maxTransactionLimit}`,
          };
        }

        // 3. Get Default API Configuration for Payin
        const apiConfig = await apiConfigDao.getDefaultApiConfig(1);
        // Product ID 1 for Payin
        if (!apiConfig) {
          throw {
            statusCode: 500,
            messageCode: "NO_API_CONFIG",
            message: "No API configuration found for Payin",
          };
        }

        // 4. Calculate Charges
        const chargeCalculation = await schemeDao.calculateCharges(
          amount,
          scheme.id,
          1
        );

        // 5. Check Service Wallet Balance
        const userWallets = await walletDao.getUserWallets(userId);
        const serviceWallet = userWallets.find(
          (w) => w.type.name === "SERVICE"
        );
        console.log("serviceWallet--> ", serviceWallet);
        if (
          !serviceWallet ||
          +serviceWallet.wallet.balance <
            +chargeCalculation.charges.totalCharges
        ) {
          throw {
            statusCode: 400,
            messageCode: "INSUFFICIENT_WALLET_BALANCE",
            message: "Insufficient balance in service wallet to cover charges",
          };
        }

        // 6. Generate Unique Transaction ID if not provided
        var uniqueIdRecord = await uniqueIdDao.createUniqueIdRecord(
          userId,
          finalOriginalUniqueId,
          amount
        );

        // generate uniquemail
        const { fullName, email } =
          nameEmailGenerator.generateUniqueNameEmail();
        // 7. Prepare Payload for Third-Party API
        console.log("email--> ", email);
        const payload = {
          uniqueid: uniqueIdRecord.generatedUniqueId, // Use generated unique ID
          amount: amount.toString(),
          email,
        };
        // 8. Encrypt Payload
        const encryptedData = await encryptionService.encrypt(payload);
        console.log("encryptedData--> ", encryptedData);
        const vendorResponse = await axios.post(apiConfig.baseUrl, {
          reseller_id: process.env.RESELLER_ID,
          reseller_pass: process.env.RESELLER_PASSWORD,
          data: encryptedData,
        });
        console.log("vendorResponse--> ", vendorResponse);
        if (!vendorResponse?.data?.Status) {
          if (
            vendorResponse.data.error_code ||
            vendorResponse.data.error_message
          ) {
            await this.logVendorResponseError({
              userId,
              uniqueId: originalUniqueId,
              transactionId: uniqueIdRecord.generatedUniqueId,
              requestPayload: payload,
              vendorResponse: vendorResponse?.data,
              errorType: "VENDOR_ERROR",
              errorMessage:
                vendorResponse?.data?.error_message || "Vendor error occurred",
            });
            throw {
              statusCode: 400,
              messageCode: "TELE",
              message: "Technical error",
            };
          }
          await this.logVendorResponseError({
            userId,
            uniqueId: originalUniqueId,
            transactionId: uniqueIdRecord.generatedUniqueId,
            requestPayload: payload,
            vendorResponse: vendorResponse?.data,
            errorType: "UNKNOWN_RESPONSE_FORMAT",
            errorMessage: "Unexpected vendor response format",
            additionalInfo: {
              receivedFields: Object.keys(vendorResponse?.data || {}),
            },
          });
          throw {
            statusCode: 400,
            messageCode: "TELE",
            message: "Technical error",
          };
        }

        const [transaction] = await tx
          .insert(payinTransactions)
          .values({
            userId,
            schemeId: scheme.id,
            apiConfigId: apiConfig.id,
            amount,
            uniqueId: finalOriginalUniqueId,
            qrString: vendorResponse.data.qr_string,
            baseAmount: +amount,
            chargeType: chargeCalculation.charges.chargeType,
            chargeValue: +chargeCalculation.charges.chargeValue,
            gstPercentage: chargeCalculation.charges.gst.percentage,
            gstAmount: chargeCalculation.charges.gst.amount,
            totalCharges: chargeCalculation.charges.totalCharges,
            status: "PENDING",
            vendorResponse: vendorResponse.data,
            transactionId: uniqueIdRecord?.generatedUniqueId,
          })
          .returning();

        const walletTransaction = await walletDao.updateWalletBalance(
          serviceWallet.wallet.id,
          chargeCalculation.charges.totalCharges,
          "DEBIT",
          `Payin Transaction Charges - ${finalOriginalUniqueId}`,
          transaction.id,
          userId,
          "PAYIN"
        );

        const schemeTransactionLog = await schemeTransactionLogDao.createLog({
          schemeId: scheme.id,
          userId,
          apiConfigId: apiConfig.id,
          amount,
          charges: chargeCalculation.charges.totalCharges,
          gst: chargeCalculation.charges.gst.amount,
          tds: chargeCalculation.charges.tds?.amount || 0,
          status: "PENDING",
          transactionId: transaction.id,
          referenceId: finalOriginalUniqueId,
          remarks: `Payin QR Generation - ${finalOriginalUniqueId}`,
        });
        return {
          transaction,
          walletTransaction,
          schemeTransactionLog,
          uniqueIdRecord,
          qrString: vendorResponse.data.qr_string,
          chargeDetails: chargeCalculation.charges,
        };
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        await this.logVendorResponseError({
          userId,
          uniqueId: uniqueIdRecord?.originalUniqueId || "",
          transactionId: uniqueIdRecord?.generatedUniqueId || "",
          requestPayload: payload,
          vendorResponse: error?.response?.data || "",
          errorType: "VENDOR_API_ERROR",
          errorMessage: error?.message,
          additionalInfo: {
            status: error?.response?.status,
            statusText: error?.response?.statusText,
            vendorUrl: "",
            requestTimestamp: new Date(),
          },
        });
        throw {
          statusCode: 400,
          messageCode: "TELE",
          message: "Technical error",
        };
      }
      console.log("Error generating QR for Payin:", error);
      log.error("Error generating QR for Payin:", error);
      throw error;
    }
  }

  async verifyTransaction(transactionId) {
    try {
      const [transaction] = await db
        .select()
        .from(payinTransactions)
        .where(eq(payinTransactions.id, transactionId));

      if (!transaction) {
        throw {
          statusCode: 404,
          messageCode: "TRANSACTION_NOT_FOUND",
          message: "Transaction not found",
        };
      }

      // TODO: Implement actual verification with vendor API
      return transaction;
    } catch (error) {
      log.error("Error verifying Payin transaction:", error);
      throw error;
    }
  }

  async getUserPayinTransactions(
    userId,
    { page = 1, limit = 10, status = null }
  ) {
    try {
      const conditions = [eq(payinTransactions.userId, userId)];

      if (status) {
        conditions.push(eq(payinTransactions.status, status));
      }

      const offset = (page - 1) * limit;

      const [transactions, countResult] = await Promise.all([
        db
          .select()
          .from(payinTransactions)
          .where(and(...conditions))
          .limit(limit)
          .offset(offset)
          .orderBy(payinTransactions.createdAt),
        db
          .select({ count: sql`count(*)` })
          .from(payinTransactions)
          .where(and(...conditions)),
      ]);

      return {
        data: transactions,
        pagination: {
          page,
          limit,
          total: Number(countResult[0].count),
          pages: Math.ceil(Number(countResult[0].count) / limit),
        },
      };
    } catch (error) {
      log.error("Error getting user Payin transactions:", error);
      throw error;
    }
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
    limit = 10,
  }) {
    try {
      const conditions = [eq(payinTransactions.userId, userId)];

      if (startDate && endDate) {
        conditions.push(
          and(
            gte(payinTransactions.createdAt, new Date(startDate)),
            lte(payinTransactions.createdAt, new Date(endDate))
          )
        );
      }

      if (status) {
        conditions.push(eq(payinTransactions.status, status));
      }

      if (minAmount) {
        conditions.push(gte(payinTransactions.amount, minAmount));
      }

      if (maxAmount) {
        conditions.push(lte(payinTransactions.amount, maxAmount));
      }

      if (search) {
        conditions.push(
          or(
            like(payinTransactions.uniqueId, `%${search}%`),
            like(payinTransactions.vendorTransactionId, `%${search}%`)
          )
        );
      }

      const offset = (page - 1) * limit;

      const [transactions, countResult] = await Promise.all([
        db
          .select()
          .from(payinTransactions)
          .where(and(...conditions))
          .limit(limit)
          .offset(offset)
          .orderBy(desc(payinTransactions.createdAt)),

        db
          .select({
            count: sql`count(*)`,
          })
          .from(payinTransactions)
          .where(and(...conditions)),
      ]);

      const [summary] = await db
        .select({
          totalAmount: sql`SUM(amount)`,
          totalCharges: sql`SUM(total_charges)`,
          successCount: sql`COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END)`,
          failedCount: sql`COUNT(CASE WHEN status = 'FAILED' THEN 1 END)`,
          pendingCount: sql`COUNT(CASE WHEN status = 'PENDING' THEN 1 END)`,
        })
        .from(payinTransactions)
        .where(and(...conditions));

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
      console.log("Error getting filtered transactions:", error);
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
    limit = 10,
  }) {
    try {
      const conditions = [];

      if (startDate && endDate) {
        conditions.push(
          and(
            gte(payinTransactions.createdAt, new Date(startDate)),
            lte(payinTransactions.createdAt, new Date(endDate))
          )
        );
      }

      if (status) {
        conditions.push(eq(payinTransactions.status, status));
      }

      if (minAmount) {
        conditions.push(gte(payinTransactions.amount, minAmount));
      }

      if (maxAmount) {
        conditions.push(lte(payinTransactions.amount, maxAmount));
      }

      if (search) {
        conditions.push(
          or(
            like(payinTransactions.uniqueId, `%${search}%`),
            like(payinTransactions.vendorTransactionId, `%${search}%`),
            like(payinTransactions.transactionId, `%${search}%`) // Added this line
          )
        );
      }

      const offset = (page - 1) * limit;

      const [transactions, countResult] = await Promise.all([
        db
          .select({
            id: payinTransactions.id,
            transactionId: payinTransactions?.transactionId,
            amount: payinTransactions.amount,
            uniqueId: payinTransactions.uniqueId,
            chargeValue: payinTransactions.chargeValue,
            gstAmount: payinTransactions.gstAmount,
            status: payinTransactions.status,
            createdAt: payinTransactions.createdAt,
            updatedAt: payinTransactions.updatedAt,
            userId: payinTransactions.userId,
            user: {
              username: users.username,
              firstname: users.firstname,
              lastname: users.lastname,
              emailId: users.emailId,
              phoneNo: users.phoneNo,
            },
          })
          .from(payinTransactions)
          .leftJoin(users, eq(payinTransactions.userId, users.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(payinTransactions.createdAt)),

        db
          .select({
            count: sql`count(*)`,
          })
          .from(payinTransactions)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      console.log("transactions--> ", transactions[0]);
      const [summary] = await db
        .select({
          totalAmount: sql`SUM(amount)`,
          totalCharges: sql`SUM(total_charges)`,
          successCount: sql`COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END)`,
          failedCount: sql`COUNT(CASE WHEN status = 'FAILED' THEN 1 END)`,
          pendingCount: sql`COUNT(CASE WHEN status = 'PENDING' THEN 1 END)`,
        })
        .from(payinTransactions)
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
      console.log("Error getting admin transactions:", error);
      log.error("Error getting admin transactions:", error);
      throw error;
    }
  }

  async processStatusChange(transaction, isSuccess, amount, bankRRN) {
    try {
      return await db.transaction(async (tx) => {
        const [updatedTransaction] = await tx
          .update(payinTransactions)
          .set({
            status: isSuccess ? "SUCCESS" : "FAILED",
            vendorTransactionId: bankRRN,
            updatedAt: new Date(),
          })
          .where(eq(payinTransactions.id, transaction.id))
          .returning();
        const userWallets = await walletDao.getUserWallets(transaction.userId);
        const serviceWallet = userWallets.find(
          (w) => w.type.name === "SERVICE"
        );
        const collectionWallet = userWallets.find(
          (w) => w.type.name === "COLLECTION"
        );
        if (!serviceWallet || !collectionWallet) {
          throw new Error("Required wallets not found");
        }
        if (isSuccess) {
          await walletDao.updateWalletBalance(
            collectionWallet.wallet.id,
            amount,
            "CREDIT",
            `Payin Transaction Credit - ${transaction.uniqueId}`,
            transaction.transactionId,
            transaction.userId,
            "PAYIN"
          );
        } else {
          await walletDao.updateWalletBalance(
            serviceWallet.wallet.id,
            transaction.totalCharges,
            "CREDIT",
            `Payin Transaction Charge Refund - ${transaction.uniqueId}`,
            transaction.transactionId,
            transaction.userId,
            "PAYIN"
          );
        }
        return updatedTransaction;
      });
    } catch (error) {
      log.error("Error processing status change:", error);
      throw error;
    }
  }

  async getTransactionByUniqueId(uniqueId) {
    try {
      const [transaction] = await db
        .select()
        .from(payinTransactions)
        .where(eq(payinTransactions.uniqueId, uniqueId))
        .limit(1);
      return transaction;
    } catch (error) {
      log.error("Error getting transaction:", error);
      throw error;
    }
  }
}

module.exports = new PayinDao();
