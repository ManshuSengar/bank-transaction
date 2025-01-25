// const Logger = require("../logger/logger");
// const log = new Logger("Batch-Transaction-Processor");
// const { db, payinTransactions } = require("../payin-service/db/schema");
// const { eq } = require("drizzle-orm");
// const payinDao = require("../payin-service/payin-dao");

// class BatchTransactionProcessor {
//   constructor() {
//     this.batchSize = 100;
//     this.processDelay = 500;
//   }

//   async markPendingTransactionsAsFailed() {
//     let processedCount = 0;
//     let hasMore = true;
//     let currentPage = 0;

//     while (hasMore) {
//       try {
//         const pendingTransactions = await db
//           .select()
//           .from(payinTransactions)
//           .where(eq(payinTransactions.status, "PENDING"))
//           .limit(this.batchSize)
//           .offset(currentPage * this.batchSize);

//         if (pendingTransactions.length === 0) {
//           hasMore = false;
//           break;
//         }

//         log.info(`Processing batch of ${pendingTransactions.length} transactions`);

//         for (const transaction of pendingTransactions) {
//           try {
//             await payinDao.processStatusChange(
//               transaction,
//               false,
//               transaction.amount,
//               null
//             );
//             processedCount++;
//             log.info(`Marked transaction ${transaction.uniqueId} as failed`);
//           } catch (error) {
//             log.error(`Error processing transaction ${transaction.uniqueId}:`, error);
//           }

//           await new Promise(resolve => setTimeout(resolve, this.processDelay));
//         }

//         currentPage++;
        
//         if (pendingTransactions.length < this.batchSize) {
//           hasMore = false;
//         }
//       } catch (error) {
//         log.error("Error processing batch:", error);
//         hasMore = false;
//       }
//     }

//     return {
//       success: true,
//       processedCount,
//       message: `Successfully processed ${processedCount} pending transactions`
//     };
//   }
// }

// module.exports = new BatchTransactionProcessor();