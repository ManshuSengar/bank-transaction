// payin-service/payin-dao.js
const Logger = require("../logger/logger");
const log = new Logger("Payin-Dao");
const { db, payinTransactions } = require("./db/schema");
const { eq, and, sql, desc } = require("drizzle-orm");
const encryptionService = require("../encryption-service/encryption-dao");
const schemeDao = require("../scheme-service/scheme-dao");
const apiConfigDao = require("../api-config-service/api-config-dao");
const walletDao = require("../wallet-service/wallet-dao");
const axios = require("axios");
const crypto = require("crypto");
const uniqueIdDao = require("../unique-service/unique-id-dao");
const schemeTransactionLogDao = require("../scheme-service/scheme-transaction-log-dao");

class PayinDao {
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
        console.log("apiConfig--> ", apiConfig);
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
        const uniqueIdRecord = await uniqueIdDao.createUniqueIdRecord(
          userId,
          finalOriginalUniqueId,
          amount
        );

        // 7. Prepare Payload for Third-Party API
        const payload = {
          uniqueid: uniqueIdRecord.generatedUniqueId, // Use generated unique ID
          amount: amount.toString(),
        };
        // 8. Encrypt Payload
        const encryptedData = await encryptionService.encrypt(payload);
        console.log("encryptedData--> ", encryptedData);
        // 9. Make Vendor API Call
        const vendorResponse = await axios.post(apiConfig.baseUrl, {
          reseller_id: process.env.RESELLER_ID,
          reseller_pass: process.env.RESELLER_PASSWORD,
          data: encryptedData,
        });
        console.log(
          "chargeCalculation.charges.chargeValue--> ",
          chargeCalculation
        );
        // 10. Record Transaction
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

        // 11. Deduct Charges from Service Wallet
        const walletTransaction = await walletDao.updateWalletBalance(
          serviceWallet.wallet.id,
          chargeCalculation.charges.totalCharges,
          "DEBIT",
          `Payin Transaction Charges - ${finalOriginalUniqueId}`,
          transaction.id,
          userId,
          "PAYIN"
        );

        // 12. Log Scheme Transaction
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
        // await uniqueIdDao.markUniqueIdAsUsed(uniqueIdRecord.id);
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

  // payin-dao.js

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
}

module.exports = new PayinDao();
