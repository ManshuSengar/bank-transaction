const Logger = require("../logger/logger");
const log = new Logger("Wallet-Dao");
const {
  db,
  walletTypes,
  userWallets,
  walletTransactions,
  walletTransactionLogs,
} = require("./db/schema");
const { users } = require("../user-service/db/schema");
const { eq, and, or, between, desc, sql } = require("drizzle-orm");
const crypto = require("crypto");

class WalletDao {
  generateTransactionUniqueId() {
    return crypto.randomBytes(16).toString("hex");
  }
  async initializeUserWallets(userId, tx = db) {
    // Make tx parameter optional with default as db
    try {
      // Get all wallet types
      const types = await tx.select().from(walletTypes);
      const wallets = [];

      // Create all three wallets for the user
      for (const type of types) {
        const [wallet] = await tx
          .insert(userWallets)
          .values({
            userId,
            walletTypeId: type.id,
            balance: 0,
            status: "ACTIVE",
            createdAt: new Date(),
          })
          .returning();
        wallets.push(wallet);
      }

      return wallets;
    } catch (error) {
      log.error("Error initializing user wallets:", error);
      throw error;
    }
  }
  async getUserWallets(userId) {
    try {
      const wallets = await db
        .select({
          wallet: userWallets,
          type: walletTypes,
        })
        .from(userWallets)
        .innerJoin(walletTypes, eq(userWallets.walletTypeId, walletTypes.id))
        .where(eq(userWallets.userId, userId));

      return wallets;
    } catch (error) {
      log.error("Error getting user wallets:", error);
      throw error;
    }
  }

  async getWalletBalance(walletId) {
    try {
      const [wallet] = await db
        .select()
        .from(userWallets)
        .where(eq(userWallets.id, walletId))
        .limit(1);

      return wallet?.balance || 0;
    } catch (error) {
      log.error("Error getting wallet balance:", error);
      throw error;
    }
  }

  // async updateWalletBalance(
  //   walletId,
  //   amount,
  //   type,
  //   description = "",
  //   referenceId = null,
  //   userId
  // ) {
  //   try {
  //     return await db.transaction(async (tx) => {
  //       // Get current wallet
  //       const [wallet] = await tx
  //         .select()
  //         .from(userWallets)
  //         .where(eq(userWallets.id, walletId))
  //         .limit(1);

  //       if (!wallet) {
  //         throw new Error("Wallet not found");
  //       }

  //       const balanceBefore = wallet.balance;
  //       const balanceAfter =
  //         type === "CREDIT"
  //           ? Number(balanceBefore) + Number(amount)
  //           : Number(balanceBefore) - Number(amount);

  //       // Update wallet balance
  //       const [updatedWallet] = await tx
  //         .update(userWallets)
  //         .set({
  //           balance: balanceAfter,
  //           lastTransactionAt: new Date(),
  //           updatedAt: new Date(),
  //         })
  //         .where(eq(userWallets.id, walletId))
  //         .returning();

  //       // Record transaction
  //       const [transaction] = await tx
  //         .insert(walletTransactions)
  //         .values({
  //           fromWalletId: type === "DEBIT" ? walletId : null,
  //           toWalletId: type === "CREDIT" ? walletId : null,
  //           amount,
  //           type,
  //           description,
  //           reference: referenceId,
  //           status: "SUCCESS",
  //           balanceBefore,
  //           balanceAfter,
  //           createdBy: userId,
  //           completedAt: new Date(),
  //         })
  //         .returning();

  //       return {
  //         wallet: updatedWallet,
  //         transaction,
  //       };
  //     });
  //   } catch (error) {
  //     log.error("Error updating wallet balance:", error);
  //     throw error;
  //   }
  // }

  async processTransfer(
    fromWalletId,
    toWalletId,
    amount,
    description = "",
    reference = null,
    userId
  ) {
    try {
      return await db.transaction(async (tx) => {
        const sourceBalance = await this.getWalletBalance(fromWalletId);
        if (sourceBalance < amount) {
          throw {
            statusCode: 400,
            messageCode: "INSUFFICIENT_BALANCE",
            message: "Insufficient balance for transfer",
          };
        }

        const transactionUniqueId = this.generateTransactionUniqueId();

        // Debit source wallet
        await this.updateWalletBalance(
          fromWalletId,
          amount,
          "DEBIT",
          description,
          reference,
          userId,
          "TRANSFER",
          transactionUniqueId
        );

        // Credit destination wallet
        const result = await this.updateWalletBalance(
          toWalletId,
          amount,
          "CREDIT",
          description,
          reference,
          userId,
          "TRANSFER",
          transactionUniqueId
        );

        return result;
      });
    } catch (error) {
      log.error("Error processing transfer:", error);
      throw error;
    }
  }

  async updateWalletBalance(
    walletId,
    amount,
    type,
    description = "",
    referenceId = null,
    userId,
    referenceType = "UNKNOWN",
    transactionUniqueId = null
  ) {
    try {
      return await db.transaction(async (tx) => {
        const [wallet] = await tx
          .select()
          .from(userWallets)
          .where(eq(userWallets.id, walletId))
          .limit(1);

        if (!wallet) {
          throw new Error("Wallet not found");
        }

        const balanceBefore = wallet.balance;
        const balanceAfter =
          type === "CREDIT"
            ? Number(balanceBefore) + Number(amount)
            : Number(balanceBefore) - Number(amount);

        const [updatedWallet] = await tx
          .update(userWallets)
          .set({
            balance: balanceAfter,
            lastTransactionAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userWallets.id, walletId))
          .returning();

        // Generate or use provided transactionUniqueId
        const finalTransactionUniqueId =
          transactionUniqueId || this.generateTransactionUniqueId();

        const [transaction] = await tx
          .insert(walletTransactions)
          .values({
            transactionUniqueId: finalTransactionUniqueId,
            fromWalletId: type === "DEBIT" ? walletId : null,
            toWalletId: type === "CREDIT" ? walletId : null,
            amount,
            type,
            description,
            reference: referenceId,
            status: "SUCCESS",
            balanceBefore,
            balanceAfter,
            createdBy: userId,
            completedAt: new Date(),
          })
          .returning();

        const [transactionLog] = await tx
          .insert(walletTransactionLogs)
          .values({
            transactionUniqueId: finalTransactionUniqueId,
            walletId,
            transactionId: transaction.id,
            type,
            amount,
            balanceBefore,
            balanceAfter,
            description,
            referenceType,
            referenceId,
            userId,
            status: "SUCCESS",
            additionalMetadata: JSON.stringify({
              originalDescription: description,
              transactionDetails: transaction,
            }),
          })
          .returning();

        return {
          wallet: updatedWallet,
          transaction,
          transactionLog,
        };
      });
    } catch (error) {
      log.error("Error updating wallet balance:", error);
      throw error;
    }
  }

  async getWalletTransactions(
    walletId,
    { page = 1, limit = 10, startDate, endDate, type }
  ) {
    try {
      let query = db
        .select()
        .from(walletTransactions)
        .where(
          or(
            eq(walletTransactions.fromWalletId, walletId),
            eq(walletTransactions.toWalletId, walletId)
          )
        );

      if (startDate && endDate) {
        query = query.where(
          between(
            walletTransactions.createdAt,
            new Date(startDate),
            new Date(endDate)
          )
        );
      }

      if (type) {
        query = query.where(eq(walletTransactions.type, type));
      }

      const offset = (page - 1) * limit;
      query = query
        .orderBy(desc(walletTransactions.createdAt))
        .limit(limit)
        .offset(offset);

      const [transactions, totalResult] = await Promise.all([
        query,
        db
          .select({ count: sql`count(*)` })
          .from(walletTransactions)
          .where(query.where),
      ]);

      return {
        data: transactions,
        pagination: {
          page,
          limit,
          total: totalResult[0].count,
          pages: Math.ceil(totalResult[0].count / limit),
        },
      };
    } catch (error) {
      log.error("Error getting wallet transactions:", error);
      throw error;
    }
  }

  async getUserWalletsSummary(userId) {
    try {
      const wallets = await this.getUserWallets(userId);

      const summary = {
        totalBalance: 0,
        wallets: wallets.map((w) => ({
          type: w.type.name,
          balance: w.wallet.balance,
          lastTransaction: w.wallet.lastTransactionAt,
        })),
      };

      summary.totalBalance = summary.wallets.reduce(
        (total, w) => total + Number(w.balance),
        0
      );

      return summary;
    } catch (error) {
      log.error("Error getting wallet summary:", error);
      throw error;
    }
  }

  determineReferenceType(referenceId) {
    if (!referenceId) return "MANUAL";
    if (referenceId.toString().startsWith("PAYIN_")) return "PAYIN";
    if (referenceId.toString().startsWith("PAYOUT_")) return "PAYOUT";
    if (referenceId.toString().startsWith("FUND_")) return "FUND_REQUEST";
    return "UNKNOWN";
  }

  // Add a method to retrieve wallet transaction logs
  async getWalletTransactionLogs(walletId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        type = null,
        startDate = null,
        endDate = null,
      } = options;

      const conditions = [eq(walletTransactionLogs.walletId, walletId)];

      if (type) {
        conditions.push(eq(walletTransactionLogs.type, type));
      }

      if (startDate && endDate) {
        conditions.push(
          and(
            sql`${walletTransactionLogs.createdAt} >= ${new Date(startDate)}`,
            sql`${walletTransactionLogs.createdAt} <= ${new Date(endDate)}`
          )
        );
      }

      const offset = (page - 1) * limit;

      const [logs, countResult] = await Promise.all([
        db
          .select()
          .from(walletTransactionLogs)
          .where(and(...conditions))
          .limit(limit)
          .offset(offset)
          .orderBy(walletTransactionLogs.createdAt),
        db
          .select({ count: sql`count(*)` })
          .from(walletTransactionLogs)
          .where(and(...conditions)),
      ]);

      return {
        data: logs,
        pagination: {
          page,
          limit,
          total: Number(countResult[0].count),
          pages: Math.ceil(Number(countResult[0].count) / limit),
        },
      };
    } catch (error) {
      log.error("Error getting wallet transaction logs:", error);
      throw error;
    }
  }
  async getAdvancedWalletTransactionLogs(filters) {
    try {
      const {
        userId,
        page = 1,
        limit = 10,
        type,
        referenceType,
        walletIds,
        startDate,
        endDate,
      } = filters;

      const userWallets = await this.getUserWallets(userId);
      const validWalletIds = userWallets.map((w) => w.wallet.id);
      const filterWalletIds = walletIds || validWalletIds;

      let query = db
        .select({
          id: walletTransactionLogs.id,
          transactionUniqueId: walletTransactionLogs.transactionUniqueId,
          walletId: walletTransactionLogs.walletId,
          type: walletTransactionLogs.type,
          amount: walletTransactionLogs.amount,
          description: walletTransactionLogs.description,
          referenceType: walletTransactionLogs.referenceType,
          referenceId: walletTransactionLogs.referenceId,
          createdAt: walletTransactionLogs.createdAt,
          balanceAfter: walletTransactionLogs.balanceAfter,
          balanceBefore: walletTransactionLogs.balanceBefore,
          status: walletTransactionLogs.status,
          transactionId: walletTransactionLogs.transactionId,
        })
        .from(walletTransactionLogs);

      const conditions = [
        sql`${walletTransactionLogs.walletId} IN (${filterWalletIds})`,
      ];

      if (type) {
        conditions.push(eq(walletTransactionLogs.type, type));
      }

      if (referenceType) {
        conditions.push(eq(walletTransactionLogs.referenceType, referenceType));
      }

      if (startDate && endDate) {
        const parsedStartDate = new Date(startDate);
        const parsedEndDate = new Date(endDate);
        conditions.push(
          and(
            sql`${walletTransactionLogs.createdAt} >= ${parsedStartDate}`,
            sql`${walletTransactionLogs.createdAt} <= ${parsedEndDate}`
          )
        );
      }

      query = query.where(and(...conditions));
      const offset = (page - 1) * limit;

      const [logs, countResult] = await Promise.all([
        query
          .limit(limit)
          .offset(offset)
          .orderBy(desc(walletTransactionLogs.createdAt)),
        db
          .select({ count: sql`COUNT(*)` })
          .from(walletTransactionLogs)
          .where(and(...conditions)),
      ]);

      const enrichedLogs = logs.map((log) => {
        const matchingWallet = userWallets.find(
          (w) => w.wallet.id === log.walletId
        );
        return {
          ...log,
          walletType: matchingWallet ? matchingWallet.type.name : "UNKNOWN",
        };
      });

      return {
        data: enrichedLogs,
        pagination: {
          page,
          limit,
          total: Number(countResult[0].count),
          pages: Math.ceil(Number(countResult[0].count) / limit),
        },
      };
    } catch (error) {
      log.error("Error getting advanced wallet transaction logs:", error);
      throw error;
    }
  }

  async getWalletTypes() {
    try {
      const types = await db
        .select()
        .from(walletTypes)
        .where(eq(walletTypes.status, "ACTIVE"));
      return types;
    } catch (error) {
      log.error("Error getting wallet types:", error);
      throw error;
    }
  }

  async getAllWalletsOfType(walletType) {
    try {
      const wallets = await db
        .select({
          id: userWallets.id,
          userId: userWallets.userId,
          type: walletTypes.name,
        })
        .from(userWallets)
        .innerJoin(walletTypes, eq(userWallets.walletTypeId, walletTypes.id))
        .where(eq(walletTypes.name, walletType));

      return wallets;
    } catch (error) {
      log.error("Error getting wallets by type:", error);
      throw error;
    }
  }

  async getAllWalletTransactionLogs(filters) {
    try {
      const {
        page = 1,
        limit = 10,
        type,
        referenceType,
        walletIds,
        startDate,
        endDate,
        userId,
      } = filters;

      // Start building the query
      let query = db
        .select({
          id: walletTransactionLogs.id,
          transactionUniqueId: walletTransactionLogs.transactionUniqueId,
          walletId: walletTransactionLogs.walletId,
          userId: walletTransactionLogs.userId,
          type: walletTransactionLogs.type,
          amount: walletTransactionLogs.amount,
          description: walletTransactionLogs.description,
          referenceType: walletTransactionLogs.referenceType,
          referenceId: walletTransactionLogs.referenceId,
          createdAt: walletTransactionLogs.createdAt,
          balanceAfter: walletTransactionLogs.balanceAfter,
          balanceBefore: walletTransactionLogs.balanceBefore,
          status: walletTransactionLogs.status,
          transactionId: walletTransactionLogs.transactionId,
          // Join with users table
          userData: {
            username: users.username,
            firstname: users.firstname,
            lastname: users.lastname,
          },
          // Include wallet type information
          walletTypeInfo: walletTypes.name,
        })
        .from(walletTransactionLogs)
        .leftJoin(users, eq(walletTransactionLogs.userId, users.id))
        .leftJoin(
          userWallets,
          eq(walletTransactionLogs.walletId, userWallets.id)
        )
        .leftJoin(walletTypes, eq(userWallets.walletTypeId, walletTypes.id));

      // Build conditions array
      const conditions = [];

      if (walletIds?.length) {
        conditions.push(sql`${walletTransactionLogs.walletId} IN ${walletIds}`);
      }

      if (type) {
        conditions.push(eq(walletTransactionLogs.type, type));
      }

      if (referenceType) {
        conditions.push(eq(walletTransactionLogs.referenceType, referenceType));
      }

      if (userId) {
        conditions.push(eq(walletTransactionLogs.userId, userId));
      }

      if (startDate && endDate) {
        const parsedStartDate = new Date(startDate);
        const parsedEndDate = new Date(endDate);
        conditions.push(
          and(
            sql`${walletTransactionLogs.createdAt} >= ${parsedStartDate}`,
            sql`${walletTransactionLogs.createdAt} <= ${parsedEndDate}`
          )
        );
      }

      // Apply conditions if any exist
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const offset = (page - 1) * limit;

      // Execute queries
      const [logs, countResult] = await Promise.all([
        query
          .limit(limit)
          .offset(offset)
          .orderBy(desc(walletTransactionLogs.createdAt)),
        db
          .select({ count: sql`COUNT(*)` })
          .from(walletTransactionLogs)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      // Transform the data to match the expected format
      const transformedLogs = logs.map((log) => ({
        ...log,
        user: {
          username: log.userData.username,
          firstname: log.userData.firstname,
          lastname: log.userData.lastname,
        },
        walletType: log.walletTypeInfo,
      }));

      return {
        data: transformedLogs,
        pagination: {
          page,
          limit,
          total: Number(countResult[0].count),
          pages: Math.ceil(Number(countResult[0].count) / limit),
        },
      };
    } catch (error) {
      console.error("Detailed error:", error);
      log.error("Error getting all wallet transaction logs:", error);
      throw error;
    }
  }
   
  async getTotalWalletBalances(userId) {
    try {
      const wallets = await this.getUserWallets(userId);
  
      const totalBalances = wallets.map(wallet => ({
        type: wallet.type.name,
        totalBalance: Number(wallet.wallet.balance),
        href: this.getHrefForWalletType(wallet.type.name)
      }));
  
      return totalBalances;
    } catch (error) {
      log.error("Error getting total wallet balances:", error);
      throw error;
    }

  }
  getHrefForWalletType(type) {
    switch(type.toUpperCase()) {
      case 'SERVICE': return '/business/fund-request';
      case 'COLLECTION': return '/business/payin';
      case 'PAYOUT': return '/business/payout';
      default: return '/dashboard';
    }
  }

}

module.exports = new WalletDao();
