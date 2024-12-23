const Logger = require("../logger/logger");
const log = new Logger("Wallet-Dao");
const {
  db,
  walletTypes,
  userWallets,
  walletTransactions,
  walletTransactionLogs,
} = require("./db/schema");
const { eq, and, or, between, desc, sql } = require("drizzle-orm");


class WalletDao {
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

  async updateWalletBalance(
    walletId,
    amount,
    type,
    description = "",
    referenceId = null,
    userId
  ) {
    try {
      return await db.transaction(async (tx) => {
        // Get current wallet
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

        // Update wallet balance
        const [updatedWallet] = await tx
          .update(userWallets)
          .set({
            balance: balanceAfter,
            lastTransactionAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userWallets.id, walletId))
          .returning();

        // Record transaction
        const [transaction] = await tx
          .insert(walletTransactions)
          .values({
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

        return {
          wallet: updatedWallet,
          transaction,
        };
      });
    } catch (error) {
      log.error("Error updating wallet balance:", error);
      throw error;
    }
  }

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
        // Check source wallet balance
        const sourceBalance = await this.getWalletBalance(fromWalletId);
        if (sourceBalance < amount) {
          throw {
            statusCode: 400,
            messageCode: "INSUFFICIENT_BALANCE",
            message: "Insufficient balance for transfer",
          };
        }

        // Debit source wallet
        await this.updateWalletBalance(
          fromWalletId,
          amount,
          "DEBIT",
          description,
          reference,
          userId
        );

        // Credit destination wallet
        const result = await this.updateWalletBalance(
          toWalletId,
          amount,
          "CREDIT",
          description,
          reference,
          userId
        );

        return result;
      });
    } catch (error) {
      log.error("Error processing transfer:", error);
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

  async updateWalletBalance(
    walletId,
    amount,
    type,
    description = "",
    referenceId = null,
    userId
  ) {
    try {
      return await db.transaction(async (tx) => {
        // 1. Get current wallet
        const [wallet] = await tx
          .select()
          .from(userWallets)
          .where(eq(userWallets.id, walletId))
          .limit(1);

        if (!wallet) {
          throw new Error("Wallet not found");
        }

        // 2. Calculate new balance
        const balanceBefore = wallet.balance;
        const balanceAfter =
          type === "CREDIT"
            ? Number(balanceBefore) + Number(amount)
            : Number(balanceBefore) - Number(amount);

        // 3. Update wallet balance
        const [updatedWallet] = await tx
          .update(userWallets)
          .set({
            balance: balanceAfter,
            lastTransactionAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userWallets.id, walletId))
          .returning();

        // 4. Record Wallet Transaction
        const [transaction] = await tx
          .insert(walletTransactions)
          .values({
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

        // 5. Create Detailed Wallet Transaction Log
        const [transactionLog] = await tx
          .insert(walletTransactionLogs)
          .values({
            walletId,
            transactionId: transaction.id,
            type,
            amount,
            balanceBefore,
            balanceAfter,
            description,
            referenceType: this.determineReferenceType(referenceId),
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
        console.log("Filters:", JSON.stringify(filters, null, 2));
        const { 
            userId, 
            page = 1, 
            limit = 10, 
            type,
            referenceType,
            walletIds ,
            startDate,
            endDate
        } = filters;

        // Always filter by user's wallets
        const userWallets = await this.getUserWallets(userId);
        console.log("User Wallets Full:", JSON.stringify(userWallets, null, 2));

        // Use provided wallet IDs or user's wallet IDs
        const validWalletIds = userWallets.map(w => w.wallet.id);
        const filterWalletIds = walletIds || validWalletIds;

        console.log("Filter Wallet IDs:", filterWalletIds);

        // Construct base query with explicit conditions
        let query = db
            .select({
                id: walletTransactionLogs.id,
                walletId: walletTransactionLogs.walletId,
                type: walletTransactionLogs.type,
                amount: walletTransactionLogs.amount,
                description: walletTransactionLogs.description,
                referenceType: walletTransactionLogs.referenceType,
                referenceId: walletTransactionLogs.referenceId,
                createdAt: walletTransactionLogs.createdAt,
                balanceAfter:walletTransactionLogs.balanceAfter,
                balanceBefore:walletTransactionLogs.balanceBefore,
                status:walletTransactionLogs.status,
                transactionId:walletTransactionLogs.transactionId
            })
            .from(walletTransactionLogs);

        // Build where conditions
        const conditions = [
            sql`${walletTransactionLogs.walletId} IN (${filterWalletIds})`
        ];

        // Add type filter
        if (type) {
            conditions.push(eq(walletTransactionLogs.type, type));
        }

        // Add reference type filter
        if (referenceType) {
            conditions.push(eq(walletTransactionLogs.referenceType, referenceType));
        }
        if (startDate && endDate) {
            // Parse dates and ensure they are Date objects
            const parsedStartDate = new Date(startDate);
            const parsedEndDate = new Date(endDate);

            console.log("Parsed Date Range:", {
                startDate: parsedStartDate.toISOString(),
                endDate: parsedEndDate.toISOString()
            });

            conditions.push(
                and(
                    sql`${walletTransactionLogs.createdAt} >= ${parsedStartDate}`,
                    sql`${walletTransactionLogs.createdAt} <= ${parsedEndDate}`
                )
            );
        }
        // Apply conditions
        query = query.where(and(...conditions));

        // Pagination
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
                .where(and(...conditions))
        ]);

        // Enrich logs with wallet type information
        const enrichedLogs = logs.map(log => {
            // Find the corresponding wallet for this log
            const matchingWallet = userWallets.find(w => w.wallet.id === log.walletId);
            return {
                ...log,
                walletType: matchingWallet ? matchingWallet.type.name : 'UNKNOWN'
            };
        });

        return {
            data: enrichedLogs,
            pagination: {
                page,
                limit,
                total: Number(countResult[0].count),
                pages: Math.ceil(Number(countResult[0].count) / limit)
            }
        };
    } catch (error) {
        console.error('Detailed error in getAdvancedWalletTransactionLogs:', error);
        log.error('Error getting advanced wallet transaction logs:', error);
        throw error;
    }
}

async getWalletTypes() {
    try {
        const types = await db
            .select()
            .from(walletTypes)
            .where(eq(walletTypes.status, 'ACTIVE'));
        return types;
    } catch (error) {
        log.error('Error getting wallet types:', error);
        throw error;
    }
}
}

module.exports = new WalletDao();
