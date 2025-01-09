// payout-service/payout-dao.js
const Logger = require("../logger/logger");
const log = new Logger("payout-Dao");
const { db, payoutTransactions } = require("./db/schema");
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

class PayoutDao {

  async generatePayout(userId, amount, bankAccountNo , ifsc, mobile , beneficiaryName, vpaId, originalUniqueId = null) {
    try {
      return await db.transaction(async (tx) => {
        // 1. Get User's Default payout Scheme
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
        // Product ID 1 for payout
        if (!userSchemes.length) {
          throw {
            statusCode: 400,
            messageCode: "NO_payout_SCHEME",
            message: "No payout scheme assigned to user",
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

        // 3. Get Default API Configuration for payout
        const apiConfig = await apiConfigDao.getDefaultApiConfig(2);
        console.log("apiConfig--> ", apiConfig);
        // Product ID 1 for payout
        if (!apiConfig) {
          throw {
            statusCode: 500,
            messageCode: "NO_API_CONFIG",
            message: "No API configuration found for payout",
          };
        }

        // 4. Calculate Charges
        const chargeCalculation = await schemeDao.calculateCharges(
          amount,
          scheme.id,
          1
        );

        // 5. Check Payout Wallet Balance
        const userWallets = await walletDao.getUserWallets(userId);
        const payoutWallet = userWallets.find(
          (w) => w.type.name === "PAYOUT"
        );
        console.log("payoutWallet--> ", payoutWallet);
        if (
          !payoutWallet ||
          +payoutWallet.wallet.balance <
            +chargeCalculation.charges.totalCharges
        ) {
          throw {
            statusCode: 400,
            messageCode: "INSUFFICIENT_WALLET_BALANCE",
            message: "Insufficient balance in payout wallet to cover charges",
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
            clientId: apiConfig.apiKey,
            secretKey: apiConfig.secretKey,
            number: mobile,
            transferMode: "IMPS",
            accountNo: bankAccountNo,
            ifscCode: ifsc,
            amount: amount.toString(),
            beneficiaryName: beneficiaryName,
            vpa: vpaId,
            clientOrderId: uniqueIdRecord.generatedUniqueId, // Use generated unique ID
        };
        
      
        console.log("payload--> ", payload);
        // 9. Make Vendor API Call

        const vendorResponse = await axios.post(apiConfig.baseUrl, {
          payload
        });
        console.log("vendorResponse--> ", vendorResponse);
        if (!vendorResponse?.statusCode) {
          throw {
            statusCode: 400,
            messageCode: "TELE",
            message: "Technical error",
          };
        }
        // 10. Record Transaction
        const [transaction] = await tx
          .insert(payoutTransactions)
          .values({
            userId,
            schemeId: scheme.id,
            apiConfigId: apiConfig.id,
            amount,
            uniqueId: finalOriginalUniqueId,
            utrString: vendorResponse.data.utr,
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
          `Payout Transaction Charges - ${finalOriginalUniqueId}`,
          transaction.id,
          userId,
          "payout"
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
          remarks: `payout Generation - ${finalOriginalUniqueId}`,
        });
        // await uniqueIdDao.markUniqueIdAsUsed(uniqueIdRecord.id);
        return {
          transaction,
          walletTransaction,
          schemeTransactionLog,
          uniqueIdRecord,
          utrString: vendorResponse.data.utr,
          chargeDetails: chargeCalculation.charges,
        };
      });
    } catch (error) {
      console.log("Error generating for payout:", error);
      log.error("Error generating for payout:", error);
      throw error;
    }
  }

  async verifyTransaction(transactionId) {
    try {
      const [transaction] = await db
        .select()
        .from(payoutTransactions)
        .where(eq(payoutTransactions.id, transactionId));

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
      log.error("Error verifying payout transaction:", error);
      throw error;
    }
  }

  async getUserpayoutTransactions(
    userId,
    { page = 1, limit = 10, status = null }
  ) {
    try {
      const conditions = [eq(payoutTransactions.userId, userId)];

      if (status) {
        conditions.push(eq(payoutTransactions.status, status));
      }

      const offset = (page - 1) * limit;

      const [transactions, countResult] = await Promise.all([
        db
          .select()
          .from(payoutTransactions)
          .where(and(...conditions))
          .limit(limit)
          .offset(offset)
          .orderBy(payoutTransactions.createdAt),
        db
          .select({ count: sql`count(*)` })
          .from(payoutTransactions)
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
      log.error("Error getting user payout transactions:", error);
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
            like(payoutTransactions.uniqueId, `%${search}%`),
            like(payoutTransactions.vendorTransactionId, `%${search}%`)
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
          .select({
            count: sql`count(*)`,
          })
          .from(payoutTransactions)
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
        .from(payoutTransactions)
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
            like(payoutTransactions.uniqueId, `%${search}%`),
            like(payoutTransactions.vendorTransactionId, `%${search}%`),
            like(payoutTransactions.transactionId, `%${search}%`) // Added this line
          )
        );
      }

      const offset = (page - 1) * limit;

      const [transactions, countResult] = await Promise.all([
        db
          .select({
            id: payoutTransactions.id,
            transactionId: payoutTransactions?.transactionId,
            amount: payoutTransactions.amount,
            uniqueId: payoutTransactions.uniqueId,
            chargeValue: payoutTransactions.chargeValue,
            gstAmount: payoutTransactions.gstAmount,
            status: payoutTransactions.status,
            createdAt: payoutTransactions.createdAt,
            userId: payoutTransactions.userId,
            user: {
              username: users.username,
              firstname: users.firstname,
              lastname: users.lastname,
              emailId: users.emailId,
              phoneNo: users.phoneNo,
            },
          })
          .from(payoutTransactions)
          .leftJoin(users, eq(payoutTransactions.userId, users.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(payoutTransactions.createdAt)),

        db
          .select({
            count: sql`count(*)`,
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
      console.log("Error getting admin transactions:", error);
      log.error("Error getting admin transactions:", error);
      throw error;
    }
  }
  

async processStatusChange(transaction, isSuccess, amount, bankRRN) {
  try {
    return await db.transaction(async (tx) => {
      const [updatedTransaction] = await tx
        .update(payoutTransactions)
        .set({
          status: isSuccess ? "SUCCESS" : "FAILED",
          vendorTransactionId: bankRRN,
          updatedAt: new Date()
        })
        .where(eq(payoutTransactions.id, transaction.id))
        .returning();
      const userWallets = await walletDao.getUserWallets(transaction.userId);
      const serviceWallet = userWallets.find(w => w.type.name === "SERVICE");
      const collectionWallet = userWallets.find(w => w.type.name === "COLLECTION");
      if (!serviceWallet || !collectionWallet) {
        throw new Error("Required wallets not found");
      }
      if (isSuccess) {
        await walletDao.updateWalletBalance(
          collectionWallet.wallet.id,
          amount,
          "CREDIT",
          `payout Transaction Credit - ${transaction.uniqueId}`,
          transaction.transactionId,
          transaction.userId,
          "payout"
        );
      } else {
        await walletDao.updateWalletBalance(
          serviceWallet.wallet.id,
          transaction.totalCharges,
          "CREDIT",
          `payout Transaction Charge Refund - ${transaction.uniqueId}`,
          transaction.transactionId,
          transaction.userId,
          "payout"
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
      .from(payoutTransactions)
      .where(eq(payoutTransactions.uniqueId, uniqueId))
      .limit(1);
    return transaction;
  } catch (error) {
    log.error("Error getting transaction:", error);
    throw error;
  }
}

}

module.exports = new PayoutDao();
