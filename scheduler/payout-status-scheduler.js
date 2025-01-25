// const cron = require('node-cron');
// const Logger = require('../logger/logger');
// const log = new Logger('Payout-Status-Scheduler');
// const { db, payoutTransactions } = require('../payout-service/db/schema');
// const { eq, and, lte, sql } = require('drizzle-orm');
// const axios = require('axios');
// const payoutDao = require('../payout-service/payout-dao');
// const apiConfigDao = require('../api-config-service/api-config-dao');

// class PayoutStatusScheduler {
//     constructor() {
//         this.isProcessing = false;
//         this.cronSchedule = '*/5 * * * *';  // Run every 5 minutes
//         this.batchSize = 50;
//         this.retryAttempts = 3;
//         this.processDelay = 1000;  // 1 second delay between processing each transaction
//     }

//     async start() {
//         log.info('Starting Payout Status Check Scheduler');
//         cron.schedule(this.cronSchedule, () => {
//             this.runScheduler().catch(error => {
//                 log.error('Error in scheduler execution:', {
//                     error: error.message,
//                     stack: error.stack,
//                     details: error.response?.data || error.cause
//                 });
//             });
//         });
//     }

//     async runScheduler() {
//         if (this.isProcessing) {
//             log.warn('Previous scheduler execution still running, skipping this cycle');
//             return;
//         }

//         this.isProcessing = true;
//         try {
//             await this.processAllPendingPayouts();
//         } catch (error) {
//             log.error('Critical error in scheduler:', {
//                 error: error.message,
//                 stack: error.stack,
//                 details: error.response?.data || error.cause
//             });
//             throw error;
//         } finally {
//             this.isProcessing = false;
//         }
//     }

//     async processAllPendingPayouts() {
//         const stats = {
//             totalProcessed: 0,
//             successCount: 0,
//             failedCount: 0,
//             skippedCount: 0,
//             errors: []
//         };

//         try {
//             const pendingTransactions = await this.fetchPendingTransactions();
//             log.info(`Found ${pendingTransactions.length} pending transactions to process`);

//             if (pendingTransactions.length === 0) {
//                 return;
//             }

//             const chunks = this.chunkArray(pendingTransactions, this.batchSize);

//             for (const [index, chunk] of chunks.entries()) {
//                 log.info(`Processing chunk ${index + 1} of ${chunks.length}`);
//                 try {
//                     const chunkResults = await this.processTransactionChunk(chunk);
//                     this.updateStats(stats, chunkResults);
//                 } catch (chunkError) {
//                     log.error(`Error processing chunk ${index + 1}:`, {
//                         error: chunkError.message,
//                         stack: chunkError.stack,
//                         details: chunkError.response?.data || chunkError.cause
//                     });
//                     stats.errors.push({
//                         type: 'CHUNK_ERROR',
//                         chunkIndex: index,
//                         message: chunkError.message,
//                         details: chunkError.response?.data || chunkError.cause
//                     });
//                 }

//                 if (index < chunks.length - 1) {
//                     await this.delay(this.processDelay * 2);
//                 }
//             }

//             this.logProcessingResults(stats);

//         } catch (error) {
//             log.error('Error in batch processing:', {
//                 error: error.message,
//                 stack: error.stack,
//                 details: error.response?.data || error.cause
//             });
//             throw error;
//         }
//     }

//     async fetchPendingTransactions() {
//         try {
//             const now = new Date();
//             const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours and 30 minutes in milliseconds
//             const localTime = new Date(now.getTime() + istOffset);
//             const twentyMinutesAgo = new Date(localTime.getTime() - (20 * 60 * 1000));
//             const formattedDate = twentyMinutesAgo.toISOString()
//                 .replace('T', ' ')
//                 .replace('Z', '')
//                 .slice(0, 19);
            
//             log.info('Fetching transactions before:', {
//                 twentyMinutesAgo: formattedDate,
//                 currentLocalTime: localTime.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19)
//             });
            
//             console.log('Fetching transactions before:', {
//                 twentyMinutesAgo: formattedDate,
//                 currentTime: new Date().toISOString()
//             });
//             return await db
//                 .select()
//                 .from(payoutTransactions)
//                 .where(
//                     and(
//                         eq(payoutTransactions.status, 'PENDING'),
//                         lte(payoutTransactions.createdAt, sql`${formattedDate}`)
//                     )
//                 )
//                 .orderBy(sql`created_at ASC`);
//         } catch (error) {
//             log.error('Error fetching pending transactions:', {
//                 error: error.message,
//                 stack: error.stack,
//                 code: error.code
//             });
//             throw error;
//         }
//     }

//     async processTransactionChunk(transactions) {
//         const chunkStats = {
//             totalProcessed: 0,
//             successCount: 0,
//             failedCount: 0,
//             skippedCount: 0,
//             errors: []
//         };

//         for (const transaction of transactions) {
//             try {
//                 log.info(`Starting to process transaction ${transaction.id}`);
//                 const result = await this.processTransaction(transaction);
                
//                 chunkStats.totalProcessed++;
//                 if (result.success) {
//                     chunkStats.successCount++;
//                     if (result.skipped) {
//                         chunkStats.skippedCount++;
//                     }
//                     log.info(`Successfully processed transaction ${transaction.id}`, {
//                         status: result.newStatus,
//                         skipped: result.skipped
//                     });
//                 } else {
//                     chunkStats.failedCount++;
//                     chunkStats.errors.push({
//                         transactionId: transaction.id,
//                         error: result.error,
//                         details: result.details
//                     });
//                     log.error(`Failed to process transaction ${transaction.id}:`, {
//                         error: result.error,
//                         details: result.details
//                     });
//                 }

//                 await this.delay(this.processDelay);
//             } catch (error) {
//                 chunkStats.failedCount++;
//                 chunkStats.errors.push({
//                     transactionId: transaction.id,
//                     error: error.message,
//                     details: error.response?.data || error.cause,
//                     stack: error.stack
//                 });
//                 log.error(`Error processing transaction ${transaction.id}:`, {
//                     error: error.message,
//                     stack: error.stack,
//                     details: error.response?.data || error.cause
//                 });
//             }
//         }

//         return chunkStats;
//     }

//     async processTransaction(transaction) {
//         try {
//             log.info(`Checking status for transaction ${transaction.id}`);
//             const statusResult = await this.checkTransactionStatus(transaction);

//             if (!statusResult.success) {
//                 return {
//                     success: false,
//                     error: statusResult.error,
//                     details: statusResult.details
//                 };
//             }

//             if (statusResult.noChange) {
//                 log.info(`No status change for transaction ${transaction.id}`, {
//                     currentStatus: transaction.status
//                 });
//                 return { success: true, skipped: true };
//             }

//             if (['FAILED', 'REVERSED'].includes(statusResult.newStatus) && 
//                 transaction.status !== 'FAILED') {
//                 log.info(`Processing refund for transaction ${transaction.id}`, {
//                     oldStatus: transaction.status,
//                     newStatus: statusResult.newStatus
//                 });
//                 await payoutDao.processRefund(transaction);
//             }

//             return {
//                 success: true,
//                 skipped: false,
//                 newStatus: statusResult.newStatus
//             };

//         } catch (error) {
//             return {
//                 success: false,
//                 error: error.message,
//                 details: error.response?.data || error.cause,
//                 stack: error.stack
//             };
//         }
//     }

//     async checkTransactionStatus(transaction) {
//         try {
//             const apiConfig = await apiConfigDao.getDefaultApiConfig(2);
//             if (!apiConfig) {
//                 throw new Error('No API configuration found for Payout');
//             }

//             let lastError = null;
//             let lastErrorDetails = null;

//             for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
//                 try {
//                     log.info(`Status check attempt ${attempt} for transaction ${transaction.id}`);
//                     const response = await this.makeStatusCheckRequest(apiConfig, transaction);
//                     const result = await this.processStatusResponse(response, transaction);
//                     return result;

//                 } catch (error) {
//                     lastError = error;
//                     lastErrorDetails = {
//                         response: error.response?.data,
//                         cause: error.cause,
//                         stack: error.stack
//                     };

//                     log.warn(`Attempt ${attempt} failed for transaction ${transaction.id}:`, {
//                         error: error.message,
//                         details: lastErrorDetails
//                     });

//                     if (attempt < this.retryAttempts) {
//                         const delayTime = Math.pow(2, attempt) * 1000;
//                         await this.delay(delayTime);
//                     }
//                 }
//             }

//             return {
//                 success: false,
//                 error: lastError?.message || 'Maximum retry attempts reached',
//                 details: lastErrorDetails
//             };

//         } catch (error) {
//             log.error('Error in checking transaction status:', {
//                 transactionId: transaction.id,
//                 error: error.message,
//                 stack: error.stack,
//                 details: error.response?.data || error.cause
//             });
//             throw error;
//         }
//     }

//     async makeStatusCheckRequest(apiConfig, transaction) {
//         try {
//             const response = await axios.post(
//                 `${apiConfig.baseUrl}/api/api/api-module/payout/status-check`,
//                 {
//                     clientId: process.env.PAYOUT_CLIENT_ID,
//                     secretKey: process.env.PAYOUT_SECRET_KEY,
//                     clientOrderId: transaction.id
//                 },
//                 {
//                     headers: { "Content-Type": "application/json" },
//                     timeout: 30000 // 30 seconds timeout
//                 }
//             );

//             return response;
//         } catch (error) {
//             if (error.response) {
//                 // The request was made and the server responded with a status code
//                 // that falls out of the range of 2xx
//                 throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
//             } else if (error.request) {
//                 // The request was made but no response was received
//                 throw new Error('No response received from API');
//             } else {
//                 // Something happened in setting up the request
//                 throw new Error(`Request setup error: ${error.message}`);
//             }
//         }
//     }

//     async processStatusResponse(response, transaction) {
//         if (!response.data || typeof response.data.statusCode === 'undefined') {
//             throw new Error('Invalid vendor response format');
//         }

//         try {
//             const newStatus = this.mapStatusCheckResponse(
//                 response.data.statusCode,
//                 response.data.status
//             );

//             if (newStatus === 'PENDING' || newStatus === transaction.status) {
//                 return { success: true, noChange: true };
//             }

//             await payoutDao.updateTransactionStatus(
//                 transaction.id,
//                 newStatus,
//                 response.data.utr || null,
//                 response.data
//             );

//             return { 
//                 success: true, 
//                 newStatus,
//                 noChange: false
//             };
//         } catch (error) {
//             log.error('Error processing status response:', {
//                 transactionId: transaction.id,
//                 error: error.message,
//                 response: response.data,
//                 stack: error.stack
//             });
//             throw error;
//         }
//     }

//     mapStatusCheckResponse(statusCode, statusParam = null) {
//         const mappedStatus = (() => {
//             switch (statusCode) {
//                 case 0: return 'FAILED';
//                 case 1:
//                     if (statusParam) {
//                         switch (statusParam) {
//                             case 1: return 'SUCCESS';
//                             case 0: return 'FAILED';
//                             case 4: return 'REVERSED';
//                             default: return 'PENDING';
//                         }
//                     }
//                     return 'SUCCESS';
//                 case 4: return 'REVERSED';
//                 default: return 'PENDING';
//             }
//         })();

//         log.info('Status mapping:', {
//             statusCode,
//             statusParam,
//             mappedStatus
//         });

//         return mappedStatus;
//     }

//     chunkArray(array, size) {
//         return array.reduce((chunks, item, index) => {
//             const chunkIndex = Math.floor(index / size);
//             if (!chunks[chunkIndex]) {
//                 chunks[chunkIndex] = [];
//             }
//             chunks[chunkIndex].push(item);
//             return chunks;
//         }, []);
//     }

//     updateStats(totalStats, chunkStats) {
//         totalStats.totalProcessed += chunkStats.totalProcessed;
//         totalStats.successCount += chunkStats.successCount;
//         totalStats.failedCount += chunkStats.failedCount;
//         totalStats.skippedCount += chunkStats.skippedCount;
//         totalStats.errors.push(...(chunkStats.errors || []));
//     }

//     logProcessingResults(stats) {
//         log.info('Processing Summary:', {
//             totalProcessed: stats.totalProcessed,
//             successful: stats.successCount,
//             failed: stats.failedCount,
//             skipped: stats.skippedCount,
//             errorCount: stats.errors.length
//         });

//         if (stats.errors.length > 0) {
//             log.error('Processing Errors:', {
//                 errors: stats.errors
//             });
//         }
//     }

//     delay(ms) {
//         return new Promise(resolve => setTimeout(resolve, ms));
//     }
// }

// module.exports = new PayoutStatusScheduler();