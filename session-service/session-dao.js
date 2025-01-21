const Logger = require("../logger/logger");
const log = new Logger("Session-Dao");
const { db, userSessions, users, userLoginHistory } = require("../user-service/db/schema");
const { eq, desc, and, gte, lte,sql } = require("drizzle-orm");

async function getUserSessions(page = 1, limit = 10, filters = {}) {
  try {
    const offset = (page - 1) * limit;

    // Build query conditions
    let conditions = [];
    
    if (filters.username) {
      conditions.push(eq(users.username, filters.username));
    }
    
    if (filters.isActive !== undefined) {
      conditions.push(eq(userSessions.isActive, filters.isActive));
    }
    
    if (filters.dateRange) {
      if (filters.dateRange.start) {
        conditions.push(gte(userSessions.loginAt, new Date(filters.dateRange.start)));
      }
      if (filters.dateRange.end) {
        conditions.push(lte(userSessions.loginAt, new Date(filters.dateRange.end)));
      }
    }

    // Get sessions with user details
    const sessions = await db
      .select({
        id: userSessions.id,
        sessionToken: userSessions.sessionToken,
        deviceInfo: userSessions.deviceInfo,
        ipAddress: userSessions.ipAddress,
        userAgent: userSessions.userAgent,
        latitude: userSessions.latitude,
        longitude: userSessions.longitude,
        loginAt: userSessions.loginAt,
        lastActivityAt: userSessions.lastActivityAt,
        expiresAt: userSessions.expiresAt,
        isActive: userSessions.isActive,
        user: {
          id: users.id,
          username: users.username,
          firstname: users.firstname,
          lastname: users.lastname,
          emailId: users.emailId,
        }
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(userSessions.loginAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql`COUNT(*)` })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .where(and(...conditions));

    return {
      sessions,
      pagination: {
        currentPage: page,
        totalSessions: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
        pageSize: limit,
      },
    };
  } catch (error) {
    log.error("Error in getUserSessions:", error);
    throw error;
  }
}

async function terminateSession(sessionId) {
  try {
    const [session] = await db
      .update(userSessions)
      .set({
        isActive: false,
        lastActivityAt: new Date()
      })
      .where(eq(userSessions.id, sessionId))
      .returning();

    if (!session) {
      const error = new Error("Session not found");
      error.statusCode = 404;
      error.messageCode = "SESSION_NOT_FOUND";
      error.userMessage = "Session not found";
      throw error;
    }

    return {
      success: true,
      messageCode: "SESSION_TERMINATED",
      message: "Session terminated successfully"
    };
  } catch (error) {
    log.error("Error in terminateSession:", error);
    throw error;
  }
}

module.exports = {
  getUserSessions,
  terminateSession
};