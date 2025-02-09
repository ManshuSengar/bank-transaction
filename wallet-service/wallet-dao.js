const Logger = require("../logger/logger");
const log = new Logger("Wallet-Dao");
const {
  db,
  walletTypes,
  userWallets,
  walletTransactions,
  walletTransactionLogs,
  walletLocks,
  walletLockHistory,
} = require("./db/schema");
const { users } = require("../user-service/db/schema");
const { eq, and, or, between, desc, sql, like } = require("drizzle-orm");
const crypto = require("crypto");
const AsyncLock = require("async-lock");

class WalletDao {
  constructor() {
    this.lock = new AsyncLock();
    this.lockTTL = 30000; // 30 seconds timeout
    this.walletLockPrefix = "wallet:";
  }
  generateTransactionUniqueId() {
    return crypto.randomBytes(6).toString("hex");
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
        // const sourceBalance = await this.getWalletBalance(fromWalletId);
        const availableBalance = await walletDao.getAvailableBalance(
          fromWalletId
        );
        if (availableBalance < parseFloat(amount)) {
          throw {
            statusCode: 400,
            messageCode: "INSUFFICIENT_BALANCE",
            message:
              "Insufficient available balance for transfer (some funds may be locked)",
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
    transactionUniqueId = null,
    trasaction = null
  ) {
    const lockKey = `${this.walletLockPrefix}${walletId}`;

    try {
      return await this.lock.acquire(
        lockKey,
        async () => {
          return await db.transaction(async (tx) => {
            const [wallet] = await tx
              .select()
              .from(userWallets)
              .where(eq(userWallets.id, walletId))
              .for("update")
              .limit(1);

            if (!wallet) {
              throw new Error("Wallet not found");
            }

            const balanceBefore = parseFloat(wallet.balance);
            let balanceAfter;

            if (type === "DEBIT") {
              const availableBalance = await this.getAvailableBalanceWithinTx(
                walletId,
                tx
              );
              if (availableBalance < parseFloat(amount)) {
                throw {
                  statusCode: 400,
                  messageCode: "INSUFFICIENT_BALANCE",
                  message: "Insufficient available balance for transaction",
                };
              }
              balanceAfter = balanceBefore - parseFloat(amount);
            } else {
              balanceAfter = balanceBefore + parseFloat(amount);
            }

            const [updatedWallet] = await tx
              .update(userWallets)
              .set({
                balance: balanceAfter,
                lastTransactionAt: new Date(),
                updatedAt: new Date(),
                version: sql`${userWallets.version} + 1`, // Optimistic locking
              })
              .where(
                and(
                  eq(userWallets.id, walletId),
                  eq(userWallets.version, wallet.version) // Ensure no concurrent updates
                )
              )
              .returning();

            if (!updatedWallet) {
              throw {
                statusCode: 409,
                messageCode: "CONCURRENT_UPDATE",
                message: "Wallet was updated by another transaction",
              };
            }

            const finalTransactionUniqueId =
              transactionUniqueId || crypto.randomBytes(6).toString("hex");

            const [transaction] = await tx
              .insert(walletTransactions)
              .values({
                transactionUniqueId: finalTransactionUniqueId,
                fromWalletId: type === "DEBIT" ? walletId : null,
                toWalletId: type === "CREDIT" ? walletId : null,
                amount: parseFloat(amount),
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
                amount: parseFloat(amount),
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
        },
        { timeout: this.lockTTL }
      );
    } catch (error) {
      if (error.name === "TimeoutError") {
        throw {
          statusCode: 408,
          messageCode: "LOCK_TIMEOUT",
          message: "Transaction timed out while waiting for lock",
        };
      }

      if (error.statusCode === 409) {
        return this.updateWalletBalance(
          walletId,
          amount,
          type,
          description,
          referenceId,
          userId,
          referenceType,
          transactionUniqueId,
          trasaction
        );
      }

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
        search,
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
          userData: {
            username: users.username,
            firstname: users.firstname,
            lastname: users.lastname,
          },
        })
        .from(walletTransactionLogs)
        .leftJoin(users, eq(walletTransactionLogs.userId, users.id));

      const conditions = [
        sql`${walletTransactionLogs.walletId} IN (${filterWalletIds})`,
      ];

      // Enhanced search functionality
      if (search) {
        const searchConditions = [
          like(walletTransactionLogs.transactionUniqueId, `%${search}%`),
          like(walletTransactionLogs.description, `%${search}%`),
          like(users.username, `%${search}%`),
          like(users.firstname, `%${search}%`),
          like(users.lastname, `%${search}%`),
          like(walletTransactionLogs.referenceId, `%${search}%`),
        ];
        conditions.push(or(...searchConditions));
      }

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
          .leftJoin(users, eq(walletTransactionLogs.userId, users.id))
          .where(and(...conditions)),
      ]);

      const enrichedLogs = logs.map((log) => {
        const matchingWallet = userWallets.find(
          (w) => w.wallet.id === log.walletId
        );
        return {
          ...log,
          walletType: matchingWallet ? matchingWallet.type.name : "UNKNOWN",
          user: {
            username: log.userData.username,
            firstname: log.userData.firstname,
            lastname: log.userData.lastname,
          },
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
        search,
      } = filters;

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
          userData: {
            username: users.username,
            firstname: users.firstname,
            lastname: users.lastname,
          },
          walletTypeInfo: walletTypes.name,
        })
        .from(walletTransactionLogs)
        .leftJoin(users, eq(walletTransactionLogs.userId, users.id))
        .leftJoin(
          userWallets,
          eq(walletTransactionLogs.walletId, userWallets.id)
        )
        .leftJoin(walletTypes, eq(userWallets.walletTypeId, walletTypes.id));

      const conditions = [];

      if (search) {
        conditions.push(
          or(
            like(users.username, `%${search}%`),
            like(users.firstname, `%${search}%`),
            like(users.lastname, `%${search}%`),
            like(walletTransactionLogs.transactionUniqueId, `%${search}%`),
            like(walletTransactionLogs.description, `%${search}%`),
            like(walletTransactionLogs.referenceId, `%${search}%`)
          )
        );
      }

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

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const offset = (page - 1) * limit;

      const [logs, countResult] = await Promise.all([
        query
          .limit(limit)
          .offset(offset)
          .orderBy(desc(walletTransactionLogs.createdAt)),
        db
          .select({ count: sql`COUNT(*)` })
          .from(walletTransactionLogs)
          .leftJoin(users, eq(walletTransactionLogs.userId, users.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

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
      log.error("Error getting all wallet transaction logs:", error);
      throw error;
    }
  }

  async getTotalWalletBalances(userId) {
    try {
      const wallets = await this.getUserWallets(userId);

      const balancePromises = wallets.map(async (wallet) => {
        const lockedAmount = await this.getTotalLockedAmount(wallet.wallet.id);
        const totalBalance = Number(wallet.wallet.balance);
        const availableBalance = totalBalance - lockedAmount;

        return {
          type: wallet.type.name,
          totalBalance,
          lockedAmount,
          availableBalance,
          href: this.getHrefForWalletType(wallet.type.name),
        };
      });

      const totalBalances = await Promise.all(balancePromises);
      return totalBalances;
    } catch (error) {
      log.error("Error getting total wallet balances:", error);
      throw error;
    }
  }

  getHrefForWalletType(type) {
    switch (type.toUpperCase()) {
      case "SERVICE":
        return "/business/fund-request";
      case "COLLECTION":
        return "/business/payin";
      case "PAYOUT":
        return "/business/payout";
      default:
        return "/dashboard";
    }
  }

  async getLocksByWalletId(walletId) {
    try {
      const activeLocks = await db
        .select()
        .from(walletLocks)
        .where(
          and(
            eq(walletLocks.walletId, walletId),
            eq(walletLocks.status, "ACTIVE")
          )
        );

      return activeLocks;
    } catch (error) {
      console.log("wallet error,", error);
      log.error("Error getting wallet locks:", error);
      throw error;
    }
  }

  async getTotalLockedAmount(walletId) {
    try {
      const [result] = await db
        .select({
          totalLocked: sql`COALESCE(SUM(amount), 0)`,
        })
        .from(walletLocks)
        .where(
          and(
            eq(walletLocks.walletId, walletId),
            eq(walletLocks.status, "ACTIVE")
          )
        );

      return parseFloat(result.totalLocked) || 0;
    } catch (error) {
      log.error("Error getting total locked amount:", error);
      throw error;
    }
  }

  async getAvailableBalance(walletId) {
    try {
      const [wallet] = await db
        .select()
        .from(userWallets)
        .where(eq(userWallets.id, walletId))
        .limit(1);

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const lockedAmount = await this.getTotalLockedAmount(walletId);
      return parseFloat(wallet.balance) - lockedAmount;
    } catch (error) {
      log.error("Error getting available balance:", error);
      throw error;
    }
  }

  async getAvailableBalanceWithinTx(walletId, tx) {
    const [wallet] = await tx
      .select()
      .from(userWallets)
      .where(eq(userWallets.id, walletId))
      .for("update")
      .limit(1);

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const [{ totalLocked }] = await tx
      .select({
        totalLocked: sql`COALESCE(SUM(amount), 0)`,
      })
      .from(walletLocks)
      .where(
        and(
          eq(walletLocks.walletId, walletId),
          eq(walletLocks.status, "ACTIVE")
        )
      );

    return parseFloat(wallet.balance) - parseFloat(totalLocked || 0);
  }

  async lockWalletAmount(walletId, amount, reason, userId) {
    try {
      return await db.transaction(async (tx) => {
        // Get current balance
        const availableBalance = await this.getAvailableBalance(walletId);

        if (availableBalance < amount) {
          throw {
            statusCode: 400,
            messageCode: "INSUFFICIENT_BALANCE",
            message: "Not enough available balance to lock",
          };
        }

        // Create lock record
        const [lock] = await tx
          .insert(walletLocks)
          .values({
            walletId,
            amount,
            reason,
            lockedBy: userId,
            status: "ACTIVE",
          })
          .returning();

        // Create lock history record
        await tx.insert(walletLockHistory).values({
          walletId,
          lockId: lock.id,
          action: "LOCKED",
          amount,
          reason,
          performedBy: userId,
        });

        return lock;
      });
    } catch (error) {
      log.error("Error locking wallet amount:", error);
      throw error;
    }
  }

  async unlockWalletAmount(lockId, userId, reason = "Lock released") {
    try {
      return await db.transaction(async (tx) => {
        // Get lock record
        const [lock] = await tx
          .select()
          .from(walletLocks)
          .where(
            and(
              eq(walletLocks.walletId, lockId),
              eq(walletLocks.status, "ACTIVE")
            )
          )
          .limit(1);

        if (!lock) {
          throw {
            statusCode: 404,
            messageCode: "LOCK_NOT_FOUND",
            message: "Active lock not found",
          };
        }

        // Update lock status
        const [updatedLock] = await tx
          .update(walletLocks)
          .set({
            status: "RELEASED",
            unlockedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(walletLocks.walletId, lockId))
          .returning();

        // Create lock history record
        // await tx.insert(walletLockHistory).values({
        //   walletId: lock.walletId,
        //   lockId,
        //   action: "UNLOCKED",
        //   amount: lock.amount,
        //   reason,
        //   performedBy: userId,
        // });

        return updatedLock;
      });
    } catch (error) {
      log.error("Error unlocking wallet amount:", error);
      throw error;
    }
  }

  // Add these methods to wallet-dao.js

  async getWalletLockHistory(walletId, { page = 1, limit = 10 }) {
    try {
      const offset = (page - 1) * limit;

      // Get total count
      const [{ count }] = await db
        .select({
          count: sql`count(*)`,
        })
        .from(walletLockHistory)
        .where(eq(walletLockHistory.walletId, walletId));

      // Get paginated history with user details
      const history = await db
        .select({
          history: walletLockHistory,
          user: {
            id: users.id,
            username: users.username,
            firstname: users.firstname,
            lastname: users.lastname,
          },
        })
        .from(walletLockHistory)
        .leftJoin(users, eq(walletLockHistory.performedBy, users.id))
        .where(eq(walletLockHistory.walletId, walletId))
        .orderBy(desc(walletLockHistory.performedAt))
        .limit(limit)
        .offset(offset);

      return {
        data: history.map((record) => ({
          ...record.history,
          performedByUser: record.user,
        })),
        pagination: {
          page,
          limit,
          total: parseInt(count),
          pages: Math.ceil(parseInt(count) / limit),
        },
      };
    } catch (error) {
      log.error("Error getting wallet lock history:", error);
      throw error;
    }
  }

  async getAllWalletLocks({
    status,
    userId,
    walletType,
    page = 1,
    limit = 10,
  }) {
    try {
      const offset = (page - 1) * limit;
      const conditions = [];

      if (status) {
        conditions.push(eq(walletLocks.status, status));
      }

      // Join with user wallets and wallet types for filtering
      let query = db
        .select({
          lock: walletLocks,
          wallet: userWallets,
          walletType: walletTypes,
          user: {
            id: users.id,
            username: users.username,
            firstname: users.firstname,
            lastname: users.lastname,
            emailId: users.emailId,
            phoneNo: users.phoneNo,
          },
          lockedByUser: {
            id: sql`locked_by_user.id`,
            username: sql`locked_by_user.username`,
            firstname: sql`locked_by_user.firstname`,
            lastname: sql`locked_by_user.lastname`,
          },
        })
        .from(walletLocks)
        .innerJoin(userWallets, eq(walletLocks.walletId, userWallets.id))
        .innerJoin(walletTypes, eq(userWallets.walletTypeId, walletTypes.id))
        .innerJoin(users, eq(userWallets.userId, users.id))
        .leftJoin(
          users.as("locked_by_user"),
          eq(walletLocks.lockedBy, sql`locked_by_user.id`)
        );

      if (userId) {
        conditions.push(eq(userWallets.userId, userId));
      }

      if (walletType) {
        conditions.push(eq(walletTypes.name, walletType));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Get total count
      const [{ count }] = await db
        .select({ count: sql`count(*)` })
        .from(walletLocks)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      // Get paginated results
      const locks = await query
        .orderBy(desc(walletLocks.createdAt))
        .limit(limit)
        .offset(offset);

      // Calculate totals
      const [totals] = await db
        .select({
          totalLockedAmount: sql`SUM(CASE WHEN ${walletLocks.status} = 'ACTIVE' THEN amount ELSE 0 END)`,
          activeLockCount: sql`COUNT(CASE WHEN ${walletLocks.status} = 'ACTIVE' THEN 1 END)`,
          totalLockCount: sql`COUNT(*)`,
        })
        .from(walletLocks)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        data: locks.map((record) => ({
          ...record.lock,
          wallet: {
            ...record.wallet,
            type: record.walletType,
          },
          user: record.user,
          lockedByUser: record.lockedByUser,
        })),
        pagination: {
          page,
          limit,
          total: parseInt(count),
          pages: Math.ceil(parseInt(count) / limit),
        },
        summary: {
          totalLockedAmount: parseFloat(totals.totalLockedAmount) || 0,
          activeLockCount: parseInt(totals.activeLockCount) || 0,
          totalLockCount: parseInt(totals.totalLockCount) || 0,
        },
      };
    } catch (error) {
      log.error("Error getting all wallet locks:", error);
      throw error;
    }
  }

  async updateWalletBalanceWithinTx(
    walletId,
    amount,
    type,
    description = "",
    referenceId = null,
    userId,
    referenceType = "UNKNOWN",
    transactionUniqueId = null,
    tx
  ) {
    const lockKey = `${this.walletLockPrefix}${walletId}`;

    return await this.lock.acquire(
      lockKey,
      async () => {
        const [wallet] = await tx
          .select()
          .from(userWallets)
          .where(eq(userWallets.id, walletId))
          .for("update")
          .limit(1);

        if (!wallet) {
          throw new Error("Wallet not found");
        }

        const balanceBefore = parseFloat(wallet.balance);
        let balanceAfter;

        if (type === "DEBIT") {
          const availableBalance = await this.getAvailableBalanceWithinTx(
            walletId,
            tx
          );
          if (availableBalance < parseFloat(amount)) {
            throw {
              statusCode: 400,
              messageCode: "INSUFFICIENT_BALANCE",
              message: "Insufficient available balance for transaction",
            };
          }
          balanceAfter = balanceBefore - parseFloat(amount);
        } else {
          balanceAfter = balanceBefore + parseFloat(amount);
        }

        const [updatedWallet] = await tx
          .update(userWallets)
          .set({
            balance: balanceAfter,
            lastTransactionAt: new Date(),
            updatedAt: new Date(),
            version: sql`${userWallets.version} + 1`,
          })
          .where(
            and(
              eq(userWallets.id, walletId),
              eq(userWallets.version, wallet.version)
            )
          )
          .returning();

        if (!updatedWallet) {
          throw {
            statusCode: 409,
            messageCode: "CONCURRENT_UPDATE",
            message: "Wallet was updated by another transaction",
          };
        }

        const finalTransactionUniqueId =
          transactionUniqueId || crypto.randomBytes(6).toString("hex");

        const [transaction] = await tx
          .insert(walletTransactions)
          .values({
            transactionUniqueId: finalTransactionUniqueId,
            fromWalletId: type === "DEBIT" ? walletId : null,
            toWalletId: type === "CREDIT" ? walletId : null,
            amount: parseFloat(amount),
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
            amount: parseFloat(amount),
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
      },
      { timeout: this.lockTTL }
    );
  }
}

module.exports = new WalletDao();
