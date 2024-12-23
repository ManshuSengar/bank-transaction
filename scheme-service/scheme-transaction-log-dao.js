// scheme-service/scheme-transaction-log-dao.js
const Logger = require('../logger/logger');
const log = new Logger('Scheme-Transaction-Log-Dao');
const { db, schemeTransactionLogs } = require('./db/schema');
const { eq } = require('drizzle-orm');

class SchemeTransactionLogDao {
    async createLog(logData) {
        try {
            const [log] = await db
                .insert(schemeTransactionLogs)
                .values({
                    schemeId: logData.schemeId,
                    userId: logData.userId,
                    apiConfigId: logData.apiConfigId,
                    amount: logData.amount,
                    charges: logData.charges,
                    gst: logData.gst,
                    tds: logData.tds,
                    status: logData.status,
                    transactionId: logData.transactionId,
                    referenceId: logData.referenceId,
                    remarks: logData.remarks
                })
                .returning();

            return log;
        } catch (error) {
            log.error('Error creating scheme transaction log:', error);
            throw error;
        }
    }

    async updateLogStatus(logId, status, remarks = null) {
        try {
            const [updatedLog] = await db
                .update(schemeTransactionLogs)
                .set({
                    status,
                    ...(remarks && { remarks })
                })
                .where(eq(schemeTransactionLogs.id, logId))
                .returning();

            return updatedLog;
        } catch (error) {
            log.error('Error updating scheme transaction log:', error);
            throw error;
        }
    }

    async getLogByTransactionId(transactionId) {
        try {
            const [log] = await db
                .select()
                .from(schemeTransactionLogs)
                .where(eq(schemeTransactionLogs.transactionId, transactionId))
                .limit(1);

            return log;
        } catch (error) {
            log.error('Error getting scheme transaction log:', error);
            throw error;
        }
    }
}

module.exports = new SchemeTransactionLogDao();