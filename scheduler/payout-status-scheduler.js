// scheduler/payout-status-scheduler.js
const cron = require('node-cron');
const Logger = require('../logger/logger');
const log = new Logger('Payout-Status-Scheduler');
const { db, payoutTransactions } = require('../payout-service/db/schema');
const { eq, and, lte, sql } = require('drizzle-orm');
const axios = require('axios');
const payoutDao = require('../payout-service/payout-dao');

class PayoutStatusScheduler {
    constructor() {
        this.cronSchedule = '*/5 * * * *';  // Run every 5 minutes
        this.batchSize = 50;
        this.retryAttempts = 3;
        this.processDelay = 1000;  // 1 second delay between processing each transaction
    }

    async start() {
        log.info('Starting Payout Status Check Scheduler');
        cron.schedule(this.cronSchedule, async () => {
            try {
                await this.processPayouts();
            } catch (error) {
                log.error('Error in payout status scheduler:', error);
            }
        });
    }

    async processPayouts() {
        let processedCount = 0;
        let hasMore = true;
        let currentPage = 0;

        while (hasMore) {
            try {
                const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
                
                const pendingTransactions = await db
                    .select()
                    .from(payoutTransactions)
                    .where(
                        and(
                            eq(payoutTransactions.status, 'PENDING'),
                            lte(payoutTransactions.createdAt, twentyMinutesAgo)
                        )
                    )
                    .limit(this.batchSize)
                    .offset(currentPage * this.batchSize);

                if (pendingTransactions.length === 0) {
                    hasMore = false;
                    break;
                }

                log.info(`Processing batch of ${pendingTransactions.length} payout transactions`);

                for (const transaction of pendingTransactions) {
                    await this.checkTransactionStatus(transaction);
                    processedCount++;
                    
                    // Add delay between processing each transaction
                    await new Promise(resolve => setTimeout(resolve, this.processDelay));
                }

                currentPage++;

                if (pendingTransactions.length < this.batchSize) {
                    hasMore = false;
                }

            } catch (error) {
                log.error('Error processing payout batch:', error);
                hasMore = false;
            }
        }

        log.info(`Completed processing ${processedCount} payout transactions`);
    }

    async checkTransactionStatus(transaction) {
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                log.info(`Checking status for payout ${transaction.id} (Attempt ${attempt})`);

                const apiConfig = await apiConfigDao.getDefaultApiConfig(2); // Product ID 2 for Payout
                if (!apiConfig) {
                    throw new Error("No API configuration found for Payout");
                }

                const response = await axios.post(
                    `${apiConfig.baseUrl}/api/api/api-module/payout/status-check`,
                    {
                        clientId: process.env.PAYOUT_CLIENT_ID,
                        secretKey: process.env.PAYOUT_SECRET_KEY,
                        clientOrderId: transaction.id
                    },
                    {
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                );

                if (!response.data || response.data.statusCode === undefined) {
                    throw new Error('Invalid vendor response');
                }

                const newStatus = payoutDao.mapVendorStatus(
                    response.data.statusCode,
                    response.data.status
                );

                // Only process status change if the status has changed and is not PENDING
                if (newStatus !== 'PENDING' && newStatus !== transaction.status) {
                    await payoutDao.updateTransactionStatus(
                        transaction.id,
                        newStatus,
                        response.data.utr || null,
                        response.data
                    );

                    // Process refund for failed transactions
                    if (['FAILED', 'REVERSED'].includes(newStatus) && transaction.status !== 'FAILED') {
                        await payoutDao.processRefund(transaction);
                    }

                    log.info(`Successfully updated payout ${transaction.id} status to ${newStatus}`);
                }

                break; // Success, exit retry loop

            } catch (error) {
                log.error(`Error checking payout ${transaction.id} status (Attempt ${attempt}):`, error);
                
                if (attempt === this.retryAttempts) {
                    log.error(`Failed to check status for payout ${transaction.id} after ${this.retryAttempts} attempts`);
                } else {
                    // Exponential backoff between retries
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }
    }
}

module.exports = new PayoutStatusScheduler();