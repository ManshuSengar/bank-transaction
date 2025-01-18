// fund-service/fund-dao.js
const Logger = require("../logger/logger");
const log = new Logger("Fund-Dao");
const { db, fundRequests, fundRequestLogs } = require("./db/schema");
const { eq, and, desc, sql } = require("drizzle-orm");
const walletDao = require("../wallet-service/wallet-dao");
const { users } = require("../user-service/db/schema");
const { banks } = require("../bank-service/db/schema");
const telegramService = require("../telegram-service/telegram-dao");
class FundDao {
  async createFundRequest(requestData, userId) {
    try {
      return await db.transaction(async (tx) => {
        // Validate wallet types for wallet-to-wallet transfer
        if (requestData.transferType === "WALLET_TO_WALLET") {
          const userWallets = await walletDao.getUserWallets(userId);
          const sourceWallet = userWallets.find(
            (w) => w.type.name === requestData.sourceWalletType
          );

          if (!sourceWallet) {
            throw {
              statusCode: 404,
              messageCode: "SOURCE_WALLET_NOT_FOUND",
              message: `Source wallet (${requestData.sourceWalletType}) not found`,
            };
          }

          // Check available balance considering locks
          const availableBalance = await walletDao.getAvailableBalance(
            sourceWallet.wallet.id
          );
          if (availableBalance < parseFloat(requestData.amount)) {
            throw {
              statusCode: 400,
              messageCode: "INSUFFICIENT_BALANCE",
              message:
                "Insufficient available balance in source wallet (some funds may be locked)",
            };
          }
        }

        const [request] = await tx
          .insert(fundRequests)
          .values({
            userId,
            bankId:
              requestData.transferType === "BANK_TO_WALLET"
                ? requestData.bankId
                : null,
            walletType:
              requestData.transferType === "BANK_TO_WALLET"
                ? requestData.walletType
                : requestData.targetWalletType,
            sourceWalletType:
              requestData.transferType === "WALLET_TO_WALLET"
                ? requestData.sourceWalletType
                : null,
            targetWalletType:
              requestData.transferType === "WALLET_TO_WALLET"
                ? requestData.targetWalletType
                : null,
            transferType: requestData.transferType,
            amount: requestData.amount,
            paymentMode:
              requestData.transferType === "BANK_TO_WALLET"
                ? requestData.paymentMode
                : "INTERNAL_TRANSFER",
            paymentDate: new Date(requestData.paymentDate),
            referenceNumber: requestData.referenceNumber,
            documentPath: requestData.documentPath,
            remarks: requestData.remarks,
            status: "PENDING",
          })
          .returning();

        // Perform additional validation for wallet-to-wallet transfers
        if (requestData.transferType === "WALLET_TO_WALLET") {
          // Validate sufficient balance in source wallet
          const userWallets = await walletDao.getUserWallets(userId);
          const sourceWallet = userWallets.find(
            (w) => w.type.name === requestData.sourceWalletType
          );

          if (!sourceWallet) {
            throw {
              statusCode: 404,
              messageCode: "SOURCE_WALLET_NOT_FOUND",
              message: `Source wallet (${requestData.sourceWalletType}) not found`,
            };
          }

          if (
            parseFloat(sourceWallet.wallet.balance) <
            parseFloat(requestData.amount)
          ) {
            throw {
              statusCode: 400,
              messageCode: "INSUFFICIENT_BALANCE",
              message: "Insufficient balance in source wallet",
            };
          }
        }

        // Log the creation
        await tx.insert(fundRequestLogs).values({
          requestId: request.id,
          action: "CREATED",
          newStatus: "PENDING",
          performedBy: userId,
          remarks: `${requestData.transferType} fund request created`,
        });

        const [userDetails] = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const requestWithUser = {
          ...request,
          user: userDetails,
        };

        telegramService
          .sendFundRequestNotification(requestWithUser)
          .catch((error) => {
            console.log("error--> ", error);
            log.error("Error sending Telegram notification:", error);
          });

        return request;
      });
    } catch (error) {
      log.error("Error creating fund request:", error);
      throw error;
    }
  }

  async updateRequestStatus(requestId, status, userId, remarks = null) {
    try {
      return await db.transaction(async (tx) => {
        // Get current request
        const [currentRequest] = await tx
          .select()
          .from(fundRequests)
          .where(eq(fundRequests.id, requestId))
          .limit(1);

        if (!currentRequest) {
          throw new Error("Fund request not found");
        }

        if (currentRequest.status !== "PENDING") {
          throw new Error("Can only update pending requests");
        }

        // Update request status
        const [updatedRequest] = await tx
          .update(fundRequests)
          .set({
            status,
            approvedBy: userId,
            approvedAt: new Date(),
            rejectionReason: status === "REJECTED" ? remarks : null,
            updatedAt: new Date(),
          })
          .where(eq(fundRequests.id, requestId))
          .returning();

        // Log the status change
        await tx.insert(fundRequestLogs).values({
          requestId,
          action: "STATUS_UPDATED",
          oldStatus: currentRequest.status,
          newStatus: status,
          performedBy: userId,
          remarks,
        });

        // Process approved requests
        if (status === "APPROVED") {
          // Bank to wallet transfer
          if (currentRequest.transferType === "BANK_TO_WALLET") {
            const userWallets = await walletDao.getUserWallets(
              currentRequest.userId
            );
            const targetWallet = userWallets.find(
              (w) => w.type.name === currentRequest.walletType
            );

            if (targetWallet) {
              await walletDao.updateWalletBalance(
                targetWallet.wallet.id,
                currentRequest.amount,
                "CREDIT",
                `Fund request #${requestId} approved`,
                requestId,
                currentRequest?.userId,
                "FUND_REQUEST"
              );
            }
          }
          // Wallet to wallet transfer
          else if (currentRequest.transferType === "WALLET_TO_WALLET") {
            const userWallets = await walletDao.getUserWallets(
              currentRequest.userId
            );

            const sourceWallet = userWallets.find(
              (w) => w.type.name === currentRequest.sourceWalletType
            );
            const targetWallet = userWallets.find(
              (w) => w.type.name === currentRequest.targetWalletType
            );

            if (sourceWallet && targetWallet) {
              // First debit source wallet
              await walletDao.updateWalletBalance(
                sourceWallet.wallet.id,
                currentRequest.amount,
                "DEBIT",
                `Internal Wallet Transfer #${requestId}`,
                requestId,
                currentRequest?.userId,
                "FUND_REQUEST"
              );

              // Then credit target wallet
              await walletDao.updateWalletBalance(
                targetWallet.wallet.id,
                currentRequest.amount,
                "CREDIT",
                `Internal Wallet Transfer #${requestId}`,
                requestId,
                currentRequest?.userId,
                "FUND_REQUEST"
              );
            }
          }
        }

        return updatedRequest;
      });
    } catch (error) {
      log.error("Error updating fund request status:", error);
      throw error;
    }
  }

  // Rest of the existing methods remain the same
  async getFundRequests({
    userId = null,
    status = null,
    page = 1,
    limit = 10,
  }) {
    try {
      const whereConditions = [];
      if (userId) {
        whereConditions.push(eq(fundRequests.userId, userId));
      }
      if (status) {
        whereConditions.push(eq(fundRequests.status, status));
      }

      let query = db
        .select({
          request: {
            id: fundRequests.id,
            userId: fundRequests.userId,
            bankId: fundRequests.bankId,
            walletType: fundRequests.walletType,
            sourceWalletType: fundRequests.sourceWalletType,
            targetWalletType: fundRequests.targetWalletType,
            transferType: fundRequests.transferType,
            amount: fundRequests.amount,
            paymentMode: fundRequests.paymentMode,
            paymentDate: fundRequests.paymentDate,
            referenceNumber: fundRequests.referenceNumber,
            documentPath: fundRequests.documentPath,
            remarks: fundRequests.remarks,
            status: fundRequests.status,
            approvedBy: fundRequests.approvedBy,
            approvedAt: fundRequests.approvedAt,
            rejectionReason: fundRequests.rejectionReason,
            createdAt: fundRequests.createdAt,
            updatedAt: fundRequests.updatedAt,
          },
          user: {
            username: users.username,
            firstname: users.firstname,
            lastname: users.lastname,
            emailId: users.emailId,
            phoneNo: users.phoneNo,
          },
          bank: {
            name: banks.name,
            accountNumber: banks.accountNumber,
            ifsc: banks.ifsc,
            branch: banks.branch,
          },
        })
        .from(fundRequests)
        .leftJoin(users, eq(fundRequests.userId, users.id))
        .leftJoin(banks, eq(fundRequests.bankId, banks.id));

      if (whereConditions.length > 0) {
        query = query.where(and(...whereConditions));
      }

      const offset = (page - 1) * limit;
      query = query
        .orderBy(desc(fundRequests.createdAt))
        .limit(limit)
        .offset(offset);

      let countQuery = db.select({ count: sql`count(*)` }).from(fundRequests);
      if (whereConditions.length > 0) {
        countQuery = countQuery.where(and(...whereConditions));
      }

      const [requests, totalCount] = await Promise.all([query, countQuery]);

      const formattedRequests = requests.map((r) => ({
        ...r.request,
        user: r.user,
        bank: r.bank,
      }));

      return {
        data: formattedRequests,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit),
        },
      };
    } catch (error) {
      log.error("Error getting fund requests:", error);
      throw error;
    }
  }

  async getFundRequestById(requestId, userId = null) {
    try {
      let query = db
        .select({
          request: fundRequests,
          logs: fundRequestLogs,
        })
        .from(fundRequests)
        .leftJoin(
          fundRequestLogs,
          eq(fundRequests.id, fundRequestLogs.requestId)
        )
        .where(eq(fundRequests.id, requestId));

      if (userId) {
        query = query.where(eq(fundRequests.userId, userId));
      }

      const result = await query;

      if (!result.length) {
        return null;
      }

      // Group logs with the request
      const request = result[0].request;
      request.logs = result
        .filter((r) => r.logs)
        .map((r) => r.logs)
        .sort((a, b) => b.createdAt - a.createdAt);

      return request;
    } catch (error) {
      log.error("Error getting fund request:", error);
      throw error;
    }
  }

  // Add this method to the FundDao class in fund-dao.js

  async getFundRequestStats() {
    try {
      const [totalStats, todayStats, statusCounts] = await Promise.all([
        db
          .select({
            totalRequests: sql`COUNT(*)`,
            totalAmount: sql`SUM(amount)`,
            approvedAmount: sql`SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END)`,
            pendingAmount: sql`SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END)`,
            rejectedAmount: sql`SUM(CASE WHEN status = 'REJECTED' THEN amount ELSE 0 END)`,
          })
          .from(fundRequests),

        db
          .select({
            totalRequests: sql`COUNT(*)`,
            totalAmount: sql`SUM(amount)`,
            approvedAmount: sql`SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END)`,
            pendingAmount: sql`SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END)`,
            rejectedAmount: sql`SUM(CASE WHEN status = 'REJECTED' THEN amount ELSE 0 END)`,
          })
          .from(fundRequests)
          .where(sql`DATE(created_at) = CURRENT_DATE`),

        db
          .select({
            status: fundRequests.status,
            count: sql`COUNT(*)`,
          })
          .from(fundRequests)
          .groupBy(fundRequests.status),
      ]);

      return {
        overall: {
          totalRequests: parseInt(totalStats[0].totalRequests) || 0,
          totalAmount: parseFloat(totalStats[0].totalAmount) || 0,
          approvedAmount: parseFloat(totalStats[0].approvedAmount) || 0,
          pendingAmount: parseFloat(totalStats[0].pendingAmount) || 0,
          rejectedAmount: parseFloat(totalStats[0].rejectedAmount) || 0,
        },
        today: {
          totalRequests: parseInt(todayStats[0].totalRequests) || 0,
          totalAmount: parseFloat(todayStats[0].totalAmount) || 0,
          approvedAmount: parseFloat(todayStats[0].approvedAmount) || 0,
          pendingAmount: parseFloat(todayStats[0].pendingAmount) || 0,
          rejectedAmount: parseFloat(todayStats[0].rejectedAmount) || 0,
        },
        statusCounts: statusCounts.reduce((acc, curr) => {
          acc[curr.status.toLowerCase()] = parseInt(curr.count);
          return acc;
        }, {}),
      };
    } catch (error) {
      log.error("Error getting fund request statistics:", error);
      throw error;
    }
  }
}

module.exports = new FundDao();
