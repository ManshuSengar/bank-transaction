// api-token-dao.js
const Logger = require("../logger/logger");
const log = new Logger("API-Token-Dao");
const { db, apiTokens, apiTokenLogs } = require("./db/schema");
const { eq, and, like, or, sql } = require("drizzle-orm");
const crypto = require("crypto");
const {users}=require("../user-service/db/schema")

class ApiTokenDao {
  generateToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  async createToken(tokenData) {
    try {
      const [token] = await db
        .insert(apiTokens)
        .values({
          ...tokenData,
          token: this.generateToken(),
          status: "PENDING",
        })
        .returning();
      return token;
    } catch (error) {
      log.error("Error creating API token:", error);
      throw error;
    }
  }

  async updateToken(tokenId, tokenData) {
    try {
      const updates = {
        ...tokenData,
        updatedAt: new Date(),
      };

      // Generate new token if status is being changed to ACTIVE
      if (tokenData.status === "ACTIVE") {
        updates.token = this.generateToken();
      }

      const [token] = await db
        .update(apiTokens)
        .set(updates)
        .where(eq(apiTokens.id, tokenId))
        .returning();
      return token;
    } catch (error) {
      log.error("Error updating API token:", error);
      throw error;
    }
  }

  async getTokens({ page = 1, limit = 10, status = null, search = null }) {
    try {
      const conditions = [];

      if (status) {
        conditions.push(eq(apiTokens.status, status));
      }

      if (search) {
        conditions.push(
          or(
            like(apiTokens.name, `%${search}%`),
            like(apiTokens.description, `%${search}%`)
          )
        );
      }

      const offset = (page - 1) * limit;
      const baseQuery = db
        .select({
          token: {
            id: apiTokens.id,
            userId: apiTokens.userId,
            name: apiTokens.name,
            description: apiTokens.description,
            ipAddresses: apiTokens.ipAddresses,
            status: apiTokens.status,
            lastUsedAt: apiTokens.lastUsedAt,
            expiresAt: apiTokens.expiresAt,
            rejectionReason: apiTokens.rejectionReason,
            approvedBy: apiTokens.approvedBy,
            approvedAt: apiTokens.approvedAt,
            createdAt: apiTokens.createdAt,
            updatedAt: apiTokens.updatedAt,
          },
          user: {
            username: users.username,
            firstname: users.firstname,
            lastname: users.lastname,
            emailId: users.emailId,
            phoneNo: users.phoneNo,
          },
        })
        .from(apiTokens)
        .leftJoin(users, eq(apiTokens.userId, users.id));

      const [tokens, countResult] = await Promise.all([
        conditions.length > 0
          ? baseQuery
              .where(and(...conditions))
              .limit(limit)
              .offset(offset)
              .orderBy(apiTokens.createdAt)
          : baseQuery.limit(limit).offset(offset).orderBy(apiTokens.createdAt),

        conditions.length > 0
          ? db
              .select({ count: sql`count(*)` })
              .from(apiTokens)
              .where(and(...conditions))
          : db.select({ count: sql`count(*)` }).from(apiTokens),
      ]);

      return {
        data: tokens.map((t) => ({
          ...t.token,
          token: undefined,
          user: t.user,
        })),
        pagination: {
          page,
          limit,
          total: Number(countResult[0].count),
          pages: Math.ceil(Number(countResult[0].count) / limit),
        },
      };
    } catch (error) {
      log.error("Error getting API tokens:", error);
      throw error;
    }
  }
  async getUserTokens(userId) {
    try {
      const tokens = await db
        .select()
        .from(apiTokens)
        .where(eq(apiTokens.userId, userId))
        .orderBy(apiTokens.createdAt);
      return tokens;
    } catch (error) {
      log.error("Error getting user tokens:", error);
      throw error;
    }
  }

  async getTokenByValue(token) {
    try {
      const tokens = await db
        .select()
        .from(apiTokens)
        .where(eq(apiTokens.token, token))
        .orderBy(apiTokens.createdAt);
      console.log("token--> ", tokens);
      return tokens;
    } catch (error) {
      log.error("Error getting user tokens:", error);
      throw error;
    }
  }

  async getTokenById(id) {
    try {
      const [token] = await db
        .select()
        .from(apiTokens)
        .where(eq(apiTokens.id, id))
        .limit(1);
      return token;
    } catch (error) {
      log.error("Error getting token by ID:", error);
      throw error;
    }
  }

  async getTokenLogs(tokenId, { page = 1, limit = 10 }) {
    try {
      const offset = (page - 1) * limit;
      const [logs, countResult] = await Promise.all([
        db
          .select()
          .from(apiTokenLogs)
          .where(eq(apiTokenLogs.tokenId, tokenId))
          .limit(limit)
          .offset(offset)
          .orderBy(apiTokenLogs.createdAt),
        db
          .select({ count: sql`count(*)` })
          .from(apiTokenLogs)
          .where(eq(apiTokenLogs.tokenId, tokenId)),
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
      log.error("Error getting token logs:", error);
      throw error;
    }
  }

  async logTokenUsage(logData) {
    try {
      const [log] = await db.insert(apiTokenLogs).values(logData).returning();
      return log;
    } catch (error) {
      log.error("Error logging token usage:", error);
      throw error;
    }
  }

  async updateTokenStatus(tokenId, status, rejectionReason, userId) {
    try {
      const updateData = {
        status,
        updatedAt: new Date(),
      };

      if (status === "REJECTED") {
        updateData.rejectionReason = rejectionReason;
      }

      if (status === "ACTIVE" || status === "REJECTED") {
        updateData.approvedBy = userId;
        updateData.approvedAt = new Date();
      }

      // Generate new token if status is being changed to ACTIVE
      if (status === "ACTIVE") {
        updateData.token = this.generateToken();
      }

      const [token] = await db
        .update(apiTokens)
        .set(updateData)
        .where(eq(apiTokens.id, tokenId))
        .returning();

      return token;
    } catch (error) {
      log.error("Error updating token status:", error);
      throw error;
    }
  }

  async getValidToken(token, ipAddress) {
    console.log("token,token", token, "--> ", ipAddress);
    try {
      const tokens = await db
        .select()
        .from(apiTokens)
        .where(eq(apiTokens.token, token))
        .orderBy(apiTokens.createdAt);
      console.log("tokens--> ", tokens);
      if (!tokens.length) {
        return null;
      }
      const validToken = tokens.find((token) => {
        if (token.status !== "ACTIVE") return false;
        if (!token.ipAddresses) return true;
        const whitelistedIps = token.ipAddresses
          .split(",")
          .map((ip) => ip.trim());
        return whitelistedIps.includes(ipAddress);
      });
      return validToken || null;
    } catch (error) {
      log.error("Error getting valid token:", error);
      throw error;
    }
  }
}

module.exports = new ApiTokenDao();
