// scheduler/payment-status-scheduler.js
const cron = require("node-cron");
const Logger = require("../logger/logger");
const log = new Logger("Payment-Status-Scheduler");
const { db, payinTransactions } = require("../payin-service/db/schema");
const { eq, and, lte, sql } = require("drizzle-orm");
const axios = require("axios");
const payinDao = require("../payin-service/payin-dao");

class PaymentStatusScheduler {
  constructor() {
    this.cronSchedule = "*/5 * * * *";
    this.batchSize = 50;
    this.retryAttempts = 1;
    this.processDelay = 1000;
  }

  async start() {
    log.info("Starting Payment Status Check Scheduler");
    cron.schedule(this.cronSchedule, async () => {
      try {
        await this.processPayments();
      } catch (error) {
        log.error("Error in payment status scheduler:", error);
      }
    });
  }

  async processPayments() {
    let processedCount = 0;
    let hasMore = true;
    let currentPage = 0;

    while (hasMore) {
      try {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const localTime = new Date(now.getTime() + istOffset);
        const twentyMinutesAgo = new Date(localTime.getTime() - 20 * 60 * 1000);
        const formattedDate = twentyMinutesAgo
          .toISOString()
          .replace("T", " ")
          .replace("Z", "")
          .slice(0, 19);

        log.info("Fetching transactions before:", {
          twentyMinutesAgo: formattedDate,
          currentLocalTime: localTime
            .toISOString()
            .replace("T", " ")
            .replace("Z", "")
            .slice(0, 19),
        });

        const pendingTransactions = await db
          .select()
          .from(payinTransactions)
          .where(
            and(
              eq(payinTransactions.status, "PENDING"),
              lte(payinTransactions.createdAt, sql`${formattedDate}`)
            )
          )
          .limit(this.batchSize)
          .offset(currentPage * this.batchSize);

        if (pendingTransactions.length === 0) {
          hasMore = false;
          break;
        }

        log.info(
          `Processing batch of ${pendingTransactions.length} transactions`
        );

        for (const transaction of pendingTransactions) {
          await this.checkTransactionStatus(transaction);
          processedCount++;

          await new Promise((resolve) =>
            setTimeout(resolve, this.processDelay)
          );
        }

        currentPage++;

        if (pendingTransactions.length < this.batchSize) {
          hasMore = false;
        }
      } catch (error) {
        log.error("Error processing batch:", error);
        hasMore = false;
      }
    }

    log.info(`Completed processing ${processedCount} transactions`);
  }

  async checkTransactionStatus(transaction) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        log.info(
          `Checking status for transaction ${transaction.transactionId} (Attempt ${attempt})`
        );

        const vendorResponse = await axios.post(
          process.env.VENDOR_CHECK_STATUS_API,
          {
            reseller_id: process.env.RESELLER_ID,
            reseller_pass: process.env.RESELLER_PASSWORD,
            uniqueid: transaction.transactionId,
          }
        );
        console.log("vendorResponse--> ", vendorResponse);
        if (!vendorResponse.data.Status) {
          throw new Error("Invalid vendor response");
        }

        const statusData = vendorResponse.data.Data;
        const amount = parseFloat(statusData.TxnAmount);
        const newStatus = statusData.Status;

        // Only process status change if the status has changed and is not PENDING
        if (newStatus !== "PENDING" && newStatus !== transaction.status) {
          await payinDao.processStatusChange(
            transaction,
            newStatus === "APPROVED",
            amount,
            statusData.BankRRN
          );

          log.info(
            `Successfully updated transaction ${transaction.uniqueId} status to ${newStatus}`
          );
        }

        break;
      } catch (error) {
        log.error(
          `Error checking transaction ${transaction.uniqueId} status (Attempt ${attempt}):`,
          error
        );

        if (attempt === this.retryAttempts) {
          log.error(
            `Failed to check status for transaction ${transaction.uniqueId} after ${this.retryAttempts} attempts`
          );
        } else {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }
  }
}

module.exports = new PaymentStatusScheduler();
