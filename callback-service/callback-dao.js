const Logger = require("../logger/logger");
const log = new Logger("Callback-Dao");
const { db, callbackConfigs, callbackLogs } = require("./db/schema");
const { eq, and, like, sql } = require("drizzle-orm");
const crypto = require("crypto");

class CallbackDao {
  async createCallbackConfig(configData) {
    try {
      configData.secretKey = crypto.randomBytes(32).toString("hex");
      const [config] = await db
        .insert(callbackConfigs)
        .values({
          ...configData,
          status: configData.status || "ACTIVE",
        })
        .returning();
      return config;
    } catch (error) {
      log.error("Error creating callback config:", error);
      throw error;
    }
  }

  async updateCallbackConfig(configId, configData) {
    try {
      const [config] = await db
        .update(callbackConfigs)
        .set({
          ...configData,
          updatedAt: new Date(),
        })
        .where(eq(callbackConfigs.id, configId))
        .returning();

      return config;
    } catch (error) {
      log.error("Error updating callback config:", error);
      throw error;
    }
  }

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

  // Callback Log Methods
  async createCallbackLog(logData) {
    try {
      const [log] = await db.insert(callbackLogs).values(logData).returning();

      return log;
    } catch (error) {
      log.error("Error creating callback log:", error);
      throw error;
    }
  }

  async getCallbackLogs(configId, { page = 1, limit = 10, status = null }) {
    try {
      const conditions = [eq(callbackLogs.configId, configId)];

      if (status) {
        conditions.push(eq(callbackLogs.status, status));
      }

      const offset = (page - 1) * limit;

      const [logs, countResult] = await Promise.all([
        db
          .select()
          .from(callbackLogs)
          .where(and(...conditions))
          .limit(limit)
          .offset(offset)
          .orderBy(callbackLogs.createdAt),
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
