const Logger = require("../logger/logger");
const log = new Logger("Callback-Dao");
const { db, callbackConfigs, callbackLogs } = require("./db/schema");
const { eq, and, like, sql } = require("drizzle-orm");
const crypto = require("crypto");

class CallbackDao {
  /**
   * Creates a new callback configuration
   * @param {Object} configData - Configuration data
   * @returns {Promise<Object>} The created configuration
   */
  async createCallbackConfig(configData) {
    try {
      // Generate a random secret key for the callback
      configData.secretKey = crypto.randomBytes(32).toString("hex");
      
      const [config] = await db
        .insert(callbackConfigs)
        .values({
          ...configData,
          status: configData.status || "ACTIVE", // Default to ACTIVE if status not provided
        })
        .returning();
      
      return config;
    } catch (error) {
      log.error("Error creating callback config:", error);
      throw error;
    }
  }

  /**
   * Updates an existing callback configuration
   * @param {string} configId - ID of the configuration to update
   * @param {Object} configData - New configuration data
   * @returns {Promise<Object>} The updated configuration
   */
  async updateCallbackConfig(configId, configData) {
    try {
      const [config] = await db
        .update(callbackConfigs)
        .set({
          ...configData,
          updatedAt: new Date(), // Always update the timestamp
        })
        .where(eq(callbackConfigs.id, configId))
        .returning();

      return config;
    } catch (error) {
      log.error("Error updating callback config:", error);
      throw error;
    }
  }

  /**
   * Retrieves a callback configuration by ID
   * @param {string} configId - ID of the configuration to retrieve
   * @returns {Promise<Object|null>} The configuration object or null if not found
   */
  async getCallbackConfigById(configId) {
    try {
      const [config] = await db
        .select()
        .from(callbackConfigs)
        .where(eq(callbackConfigs.id, configId))
        .limit(1);

      return config;
    } catch (error) {
      log.error("Error getting callback config:", error);
      throw error;
    }
  }

  /**
   * Retrieves all callback configurations for a specific user
   * @param {string} userId - ID of the user
   * @returns {Promise<Array>} Array of callback configurations
   */
  async getUserCallbackConfigs(userId) {
    try {
      const configs = await db
        .select()
        .from(callbackConfigs)
        .where(eq(callbackConfigs.userId, userId));

      return configs;
    } catch (error) {
      log.error("Error getting user callback configs:", error);
      throw error;
    }
  }

  // ==============================================
  // Callback Log Methods
  // ==============================================

  /**
   * Creates a new callback log entry
   * @param {Object} logData - Log data to store
   * @returns {Promise<Object>} The created log entry
   */
  async createCallbackLog(logData) {
    try {
      const [logEntry] = await db
        .insert(callbackLogs)
        .values(logData)
        .returning();

      return logEntry;
    } catch (error) {
      log.error("Error creating callback log:", error);
      throw error;
    }
  }

  /**
   * Retrieves paginated callback logs for a specific configuration
   * @param {string} configId - ID of the callback configuration
   * @param {Object} options - Pagination and filtering options
   * @param {number} options.page - Current page number (default: 1)
   * @param {number} options.limit - Items per page (default: 10)
   * @param {string|null} options.status - Filter logs by status (optional)
   * @returns {Promise<Object>} Object containing logs and pagination info
   */
  async getCallbackLogs(configId, { page = 1, limit = 10, status = null }) {
    try {
      const conditions = [eq(callbackLogs.configId, configId)];

      // Add status filter if provided
      if (status) {
        conditions.push(eq(callbackLogs.status, status));
      }

      const offset = (page - 1) * limit;

      // Execute queries in parallel for better performance
      const [logs, countResult] = await Promise.all([
        // Get paginated logs
        db
          .select()
          .from(callbackLogs)
          .where(and(...conditions))
          .limit(limit)
          .offset(offset)
          .orderBy(callbackLogs.createdAt),
        
        // Get total count for pagination
        db
          .select({ count: sql`count(*)` })
          .from(callbackLogs)
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
      log.error("Error getting callback logs:", error);
      throw error;
    }
  }
}

module.exports = new CallbackDao();
