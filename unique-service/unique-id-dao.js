// unique-service/unique-id-dao.js
const Logger = require("../logger/logger");
const log = new Logger("Unique-ID-Dao");
const { db, uniqueIdTracking } = require("./db/schema");
const { eq, and } = require("drizzle-orm");
const crypto = require("crypto");

class UniqueIdDao {
  generateUniqueId(length = 6) {
    return crypto.randomBytes(length).toString("hex");
  }

  async checkOriginalUniqueId(userId, originalUniqueId) {
    try {
      const [existingRecord] = await db
        .select()
        .from(uniqueIdTracking)
        .where(
          and(
            eq(uniqueIdTracking.userId, userId),
            eq(uniqueIdTracking.originalUniqueId, originalUniqueId)
          )
        )
        .limit(1);

      return existingRecord;
    } catch (error) {
      log.error("Error checking unique ID:", error);
      throw error;
    }
  }

  // Create a new unique ID record
  async createUniqueIdRecord(userId, originalUniqueId, amount) {
    try {
      const generatedUniqueId = this.generateUniqueId();

      const [record] = await db
        .insert(uniqueIdTracking)
        .values({
          userId,
          originalUniqueId,
          generatedUniqueId,
          amount, 
          status: "ACTIVE",
        })
        .returning();

      return record;
    } catch (error) {
      log.error("Error creating unique ID record:", error);
      throw error;
    }
  }

  async getUniqueIdByGeneratedId(generatedUniqueId) {
    try {
      const [uniqueIdRecord] = await db
        .select()
        .from(uniqueIdTracking)
        .where(
          and(
            eq(uniqueIdTracking.generatedUniqueId, generatedUniqueId),
            eq(uniqueIdTracking.status, "ACTIVE")
          )
        )
        .limit(1);

      return uniqueIdRecord;
    } catch (error) {
      log.error("Error retrieving unique ID record:", error);
      throw error;
    }
  }

  async markUniqueIdAsUsed(id) {
    try {
      const [updatedRecord] = await db
        .update(uniqueIdTracking)
        .set({
          status: "USED",
          updatedAt: new Date(),
        })
        .where(eq(uniqueIdTracking.id, id))
        .returning();

      return updatedRecord;
    } catch (error) {
      log.error("Error marking unique ID as used:", error);
      throw error;
    }
  }
}

module.exports = new UniqueIdDao();
