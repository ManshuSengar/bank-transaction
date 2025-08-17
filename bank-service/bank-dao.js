const { db, banks, bankOperationLogs } = require("./db/schema");
const Logger = require("../logger/logger");
const log = new Logger("Bank-Dao");
const { eq, like, or, and, count } = require("drizzle-orm");

class BankDao {
  /**
   * Add a new bank to the database
   * @param {Object} bankData - Bank data to be added
   * @returns {Promise<Object>} The newly created bank record
   */
  async addBank(bankData) {
    try {
      const [bank] = await db
        .insert(banks)
        .values({
          name: bankData.name.toUpperCase(),
          accountNumber: bankData.accountNumber,
          ifsc: bankData.ifsc.toUpperCase(),
          branch: bankData.branch,
          securityPin: bankData.securityPin,
          status: bankData.status || "ACTIVE",
          createdBy: bankData.createdBy,
        })
        .returning();
      return bank;
    } catch (error) {
      console.log("error--> ", error);
      log.error("Error adding bank:", error);
      throw error;
    }
  }

  /**
   * Get paginated list of banks with optional filters
   * @param {Object} params - Query parameters
   * @param {number} params.page - Current page number
   * @param {number} params.limit - Number of items per page
   * @param {string} [params.status] - Filter by bank status
   * @param {string} [params.search] - Search term for name, account number or IFSC
   * @returns {Promise<Object>} Paginated bank list with metadata
   */
  async getBanks({ page, limit, status, search }) {
    try {
      let conditions = [];
      
      // Add status filter if provided
      if (status) {
        conditions.push(eq(banks.status, status));
      }

      // Add search filter if provided
      if (search) {
        conditions.push(
          or(
            like(banks.name, `%${search}%`),
            like(banks.accountNumber, `%${search}%`),
            like(banks.ifsc, `%${search}%`)
          )
        );
      }

      const offset = (page - 1) * limit;
      
      // Execute queries in parallel for better performance
      const [bankList, total] = await Promise.all([
        db.select()
          .from(banks)
          .where(and(...conditions))
          .limit(limit)
          .offset(offset),
        db.select({ count: count() })
          .from(banks)
          .where(and(...conditions))
      ]);

      return {
        data: bankList,
        pagination: {
          page,
          limit,
          total: total[0].count,
          pages: Math.ceil(total[0].count / limit)
        }
      };
    } catch (error) {
      console.log('Error getting banks:', error);
      log.error('Error getting banks:', error);
      throw error;
    }
  }

  /**
   * Update bank status
   * @param {number} bankId - ID of the bank to update
   * @param {string} status - New status value
   * @returns {Promise<Object>} Updated bank record
   */
  async updateBankStatus(bankId, status) {
    try {
      const [bank] = await db
        .update(banks)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(banks.id, bankId))
        .returning();
      return bank;
    } catch (error) {
      log.error("Error updating bank status:", error);
      throw error;
    }
  }

  /**
   * Get bank by ID
   * @param {number} id - Bank ID
   * @returns {Promise<Object|null>} Bank record or null if not found
   */
  async getBankById(id) {
    try {
      const [bank] = await db
        .select()
        .from(banks)
        .where(eq(banks.id, id))
        .limit(1);
      return bank;
    } catch (error) {
      log.error('Error getting bank by id:', error);
      throw error;
    }
  }

  /**
   * Update bank details
   * @param {number} id - Bank ID to update
   * @param {Object} bankData - New bank data
   * @returns {Promise<Object>} Updated bank record
   */
  async updateBank(id, bankData) {
    try {
      const [bank] = await db
        .update(banks)
        .set({
          name: bankData.name.toUpperCase(),
          accountNumber: bankData.accountNumber,
          ifsc: bankData.ifsc.toUpperCase(),
          branch: bankData.branch,
          ...(bankData.securityPin && { securityPin: bankData.securityPin }),
          balance: bankData.balance,
          minBalance: bankData.minBalance,
          maxBalance: bankData.maxBalance,
          dailyLimit: bankData.dailyLimit,
          monthlyLimit: bankData.monthlyLimit,
          updatedAt: bankData.updatedAt || new Date()
        })
        .where(eq(banks.id, id))
        .returning();
      return bank;
    } catch (error) {
      log.error('Error updating bank:', error);
      throw error;
    }
  }

  /**
   * Log a bank operation for audit purposes
   * @param {Object} logData - Operation log data
   * @returns {Promise<Object>} The created log record
   */
  async logBankOperation(logData) {
    try {
      const [log] = await db
        .insert(bankOperationLogs)
        .values({
          bankId: logData.bankId,
          operation: logData.operation,
          status: logData.status,
          details: logData.details,
          ipAddress: logData.ipAddress,
          userAgent: logData.userAgent,
          performedBy: logData.performedBy
        })
        .returning();
      return log;
    } catch (error) {
      log.error('Error logging bank operation:', error);
      throw error;
    }
  }
}

module.exports = new BankDao();
