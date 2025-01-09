// wallet-service/wallet-controller.js
const express = require("express");
const walletRouter = express.Router();
const walletDao = require("./wallet-dao");
const Logger = require("../logger/logger");
const log = new Logger("Wallet-Controller");
const {
  authenticateToken,
  authorize,
} = require("../middleware/auth-token-validator");
const XLSX = require('xlsx');
const fs = require('fs').promises;
const path = require('path');
const Joi = require("joi");

// Validation schemas
const transferSchema = Joi.object({
  fromWalletId: Joi.number().required(),
  toWalletId: Joi.number().required(),
  amount: Joi.number().positive().required(),
  description: Joi.string().max(200),
  reference: Joi.string().max(100),
});

const topupSchema = Joi.object({
  walletId: Joi.number().required(),
  amount: Joi.number().positive().required(),
  description: Joi.string().max(200),
  reference: Joi.string().max(100),
});

walletRouter.get("/wallet-type", authenticateToken, async (req, res) => {
  try {
    console.log("testing-->");
    const wallets = await walletDao.getWalletTypes();
    // console.log("wallets--> ",wallets);
    res.send({
      messageCode: "WALLETS_FETCHED",
      message: "Wallets retrieved successfully",
      wallets,
    });
  } catch (error) {
    console.log("testing-->", error);
    log.error("Error fetching user wallets:", error);
    res.status(500).send({
      messageCode: "ERR_FETCH_WALLETS",
      message: "Error retrieving wallets",
    });
  }
});

walletRouter.get("/total-balances", authenticateToken, async (req, res) => {
  try {
    const totalBalances = await walletDao.getTotalWalletBalances(
      req.user.userId
    );
    res.send({
      messageCode: "WALLET_TOTALS_FETCHED",
      message: "Wallet total balances retrieved successfully",
      walletTotals: totalBalances,
    });
  } catch (error) {
    log.error("Error fetching wallet total balances:", error);
    res.status(500).send({
      messageCode: "ERR_FETCH_WALLET_TOTALS",
      message: "Error retrieving wallet total balances",
    });
  }
});

// Get all wallets for authenticated user
walletRouter.get("/my-wallets", authenticateToken, async (req, res) => {
  try {
    const wallets = await walletDao.getUserWallets(req.user.userId);
    // console.log("wallets--> ",wallets);
    res.send({
      messageCode: "WALLETS_FETCHED",
      message: "Wallets retrieved successfully",
      wallets,
    });
  } catch (error) {
    log.error("Error fetching user wallets:", error);
    res.status(500).send({
      messageCode: "ERR_FETCH_WALLETS",
      message: "Error retrieving wallets",
    });
  }
});

walletRouter.get("/transaction-logs", authenticateToken, async (req, res) => {
  try {
    console.log("Query parameters:", req.query);
    const {
      type,
      referenceType,
      page = 1,
      limit = 10,
      walletType,
      startDate,
      endDate,
    } = req.query;

    // Validate and prepare filters
    const filters = {
      userId: req.user.userId,
      page: parseInt(page),
      limit: parseInt(limit),
    };

    // Add optional type filter
    if (type && type.trim() !== "") {
      filters.type = type.toUpperCase().trim();
    }

    // Add optional reference type filter
    if (referenceType && referenceType.trim() !== "") {
      filters.referenceType = referenceType.toUpperCase().trim();
    }
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    // If wallet type is specified, find matching wallet IDs
    if (walletType && walletType.trim() !== "") {
      const userWallets = await walletDao.getUserWallets(req.user.userId);
      const matchingWalletIds = userWallets
        .filter(
          (w) => w.type.name.toUpperCase() === walletType.toUpperCase().trim()
        )
        .map((w) => w.wallet.id);

      console.log("Matching Wallet IDs:", matchingWalletIds);

      if (matchingWalletIds.length === 0) {
        return res.status(200).send({
          messageCode: "NO_MATCHING_WALLETS",
          message: "No wallets found for the specified wallet type",
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            pages: 0,
          },
        });
      }

      filters.walletIds = matchingWalletIds;
    }

    console.log("Final Filters:", JSON.stringify(filters, null, 2));

    // Retrieve transaction logs
    const transactionLogs = await walletDao.getAdvancedWalletTransactionLogs(
      filters
    );

    res.send({
      messageCode: "TRANSACTION_LOGS_FETCHED",
      message: "Transaction logs retrieved successfully",
      ...transactionLogs,
    });
  } catch (error) {
    console.error("Detailed error in transaction logs:", error);
    log.error("Error fetching transaction logs:", error);
    res.status(500).send({
      messageCode: "ERR_FETCH_TRANSACTION_LOGS",
      message: "Error retrieving transaction logs",
      errorDetails: error.message,
    });
  }
});

// Get specific wallet details
walletRouter.get("/:walletId", authenticateToken, async (req, res) => {
  try {
    // Verify wallet belongs to user
    const wallets = await walletDao.getUserWallets(req.user.userId);
    const wallet = wallets.find(
      (w) => w.wallet.id === parseInt(req.params.walletId)
    );

    if (!wallet) {
      return res.status(404).send({
        messageCode: "WALLET_NOT_FOUND",
        message: "Wallet not found or access denied",
      });
    }

    res.send({
      messageCode: "WALLET_FETCHED",
      message: "Wallet details retrieved successfully",
      wallet,
    });
  } catch (error) {
    log.error("Error fetching wallet details:", error);
    res.status(500).send({
      messageCode: "ERR_FETCH_WALLET",
      message: "Error retrieving wallet details",
    });
  }
});

// Get wallet balance
walletRouter.get("/:walletId/balance", authenticateToken, async (req, res) => {
  try {
    // Verify wallet belongs to user
    const wallets = await walletDao.getUserWallets(req.user.userId);
    const wallet = wallets.find(
      (w) => w.wallet.id === parseInt(req.params.walletId)
    );

    if (!wallet) {
      return res.status(404).send({
        messageCode: "WALLET_NOT_FOUND",
        message: "Wallet not found or access denied",
      });
    }

    const balance = await walletDao.getWalletBalance(req.params.walletId);
    res.send({
      messageCode: "BALANCE_FETCHED",
      message: "Balance retrieved successfully",
      balance,
      walletType: wallet.type.name,
    });
  } catch (error) {
    log.error("Error fetching wallet balance:", error);
    res.status(500).send({
      messageCode: "ERR_FETCH_BALANCE",
      message: "Error retrieving wallet balance",
    });
  }
});

// Transfer between wallets
walletRouter.post("/transfer", authenticateToken, async (req, res) => {
  try {
    const { error } = transferSchema.validate(req.body);
    if (error) {
      return res.status(400).send({
        messageCode: "VALIDATION_ERROR",
        message: error.details[0].message,
      });
    }

    // Verify both wallets belong to user
    const userWallets = await walletDao.getUserWallets(req.user.userId);
    const fromWallet = userWallets.find(
      (w) => w.wallet.id === req.body.fromWalletId
    );
    const toWallet = userWallets.find(
      (w) => w.wallet.id === req.body.toWalletId
    );

    if (!fromWallet || !toWallet) {
      return res.status(403).send({
        messageCode: "WALLET_ACCESS_DENIED",
        message: "You can only transfer between your own wallets",
      });
    }

    // Process transfer
    const result = await walletDao.processTransfer(
      req.body.fromWalletId,
      req.body.toWalletId,
      req.body.amount,
      req.body.description,
      req.body.reference,
      req.user.userId
    );

    res.send({
      messageCode: "TRANSFER_SUCCESS",
      message: "Transfer completed successfully",
      transaction: result.transaction,
    });
  } catch (error) {
    log.error("Error processing transfer:", error);
    res.status(error.statusCode || 500).send({
      messageCode: error.messageCode || "ERR_TRANSFER",
      message: error.message || "Error processing transfer",
    });
  }
});

// Top up wallet (admin only)
walletRouter.post(
  "/topup",
  authenticateToken,
  authorize(["manage_wallets"]),
  async (req, res) => {
    try {
      const { error } = topupSchema.validate(req.body);
      if (error) {
        return res.status(400).send({
          messageCode: "VALIDATION_ERROR",
          message: error.details[0].message,
        });
      }

      const result = await walletDao.updateWalletBalance(
        req.body.walletId,
        req.body.amount,
        "CREDIT",
        req.body.description || "Admin topup",
        req.body.reference,
        req.user.userId,
        "FUND_REQUEST"
      );

      res.send({
        messageCode: "TOPUP_SUCCESS",
        message: "Wallet topped up successfully",
        transaction: result.transaction,
      });
    } catch (error) {
      log.error("Error processing topup:", error);
      res.status(500).send({
        messageCode: "ERR_TOPUP",
        message: "Error processing wallet topup",
      });
    }
  }
);

// Get wallet transactions
walletRouter.get(
  "/:walletId/transactions",
  authenticateToken,
  async (req, res) => {
    try {
      // Verify wallet belongs to user
      const wallets = await walletDao.getUserWallets(req.user.userId);
      const wallet = wallets.find(
        (w) => w.wallet.id === parseInt(req.params.walletId)
      );

      if (!wallet) {
        return res.status(404).send({
          messageCode: "WALLET_NOT_FOUND",
          message: "Wallet not found or access denied",
        });
      }

      const { page = 1, limit = 10, startDate, endDate, type } = req.query;

      const transactions = await walletDao.getWalletTransactions(
        req.params.walletId,
        {
          page: parseInt(page),
          limit: parseInt(limit),
          startDate,
          endDate,
          type,
        }
      );

      res.send({
        messageCode: "TRANSACTIONS_FETCHED",
        message: "Transactions retrieved successfully",
        ...transactions,
      });
    } catch (error) {
      log.error("Error fetching wallet transactions:", error);
      res.status(500).send({
        messageCode: "ERR_FETCH_TRANSACTIONS",
        message: "Error retrieving wallet transactions",
      });
    }
  }
);

// Get wallet summary for dashboard
walletRouter.get("/summary", authenticateToken, async (req, res) => {
  try {
    const summary = await walletDao.getUserWalletsSummary(req.user.userId);
    res.send({
      messageCode: "SUMMARY_FETCHED",
      message: "Wallet summary retrieved successfully",
      summary,
    });
  } catch (error) {
    log.error("Error fetching wallet summary:", error);
    res.status(500).send({
      messageCode: "ERR_FETCH_SUMMARY",
      message: "Error retrieving wallet summary",
    });
  }
});

// Get all wallet transactions (admin only)
walletRouter.get(
  "/admin/all-transactions",
  authenticateToken,
  // authorize(["manage_wallets"]), // Ensure only admins can access
  async (req, res) => {
    try {
      console.log("Query parameters:", req.query);
      const {
        type,
        referenceType,
        page = 1,
        limit = 10,
        walletType,
        startDate,
        endDate,
        userId,
        search
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: parseInt(limit),
      };
      if (type?.trim()) {
        filters.type = type.toUpperCase().trim();
      }
      if(search?.trim()){
        filters.search = search.trim();
      }

      if (referenceType?.trim()) {
        filters.referenceType = referenceType.toUpperCase().trim();
      }
      if (startDate && endDate) {
        filters.startDate = startDate;
        filters.endDate = endDate;
      }
      if (userId) {
        filters.userId = parseInt(userId);
      }
      if (walletType?.trim()) {
        const allWallets = await walletDao.getAllWalletsOfType(
          walletType.trim().toUpperCase()
        );
        if (allWallets.length === 0) {
          return res.status(200).send({
            messageCode: "NO_MATCHING_WALLETS",
            message: "No wallets found for the specified wallet type",
            data: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              pages: 0,
            },
          });
        }
        filters.walletIds = allWallets.map((w) => w.id);
      }
      const transactionLogs = await walletDao.getAllWalletTransactionLogs(
        filters
      );
      res.send({
        messageCode: "TRANSACTION_LOGS_FETCHED",
        message: "Transaction logs retrieved successfully",
        ...transactionLogs,
      });
    } catch (error) {
      console.error("Detailed error in transaction logs:", error);
      log.error("Error fetching transaction logs:", error);
      res.status(500).send({
        messageCode: "ERR_FETCH_TRANSACTION_LOGS",
        message: "Error retrieving transaction logs",
        errorDetails: error.message,
      });
    }
  }
);

walletRouter.get("/admin/excel-transaction/download", 
  authenticateToken,
  // authorize(["manage_wallets"]), // Uncomment if you want role-based access
  async (req, res) => {
      try {
          console.log("Query parameters:", req.query);
          const {
              type,
              referenceType,
              walletType,
              startDate,
              endDate,
              userId,
              search
          } = req.query;

          const filters = {
              page: 1,
              limit: 100000 
          };
          
          if (type?.trim()) {
              filters.type = type.toUpperCase().trim();
          }
          if(search?.trim()){
              filters.search = search.trim();
          }

          if (referenceType?.trim()) {
              filters.referenceType = referenceType.toUpperCase().trim();
          }
          if (startDate && endDate) {
              filters.startDate = startDate;
              filters.endDate = endDate;
          }
          if (userId) {
              filters.userId = parseInt(userId);
          }
          if (walletType?.trim()) {
              const allWallets = await walletDao.getAllWalletsOfType(
                  walletType.trim().toUpperCase()
              );
              if (allWallets.length === 0) {
                  return res.status(200).send({
                      messageCode: "NO_MATCHING_WALLETS",
                      message: "No wallets found for the specified wallet type",
                      data: [],
                      pagination: {
                          page: 1,
                          limit: 10,
                          total: 0,
                          pages: 0,
                      },
                  });
              }
              filters.walletIds = allWallets.map((w) => w.id);
          }

          const transactionLogs = await walletDao.getAllWalletTransactionLogs(filters);

          // Transform data for Excel export
          const excelData = transactionLogs.data.map(log => ({
              'Transaction ID': log.transactionId,
              'Transaction Unique ID': log.transactionUniqueId,
              'Username': log.user.username,
              'Full Name': `${log.user.firstname} ${log.user.lastname}`,
              'Wallet Type': log.walletType,
              'Transaction Type': log.type,
              'Reference Type': log.referenceType,
              'Reference ID': log.referenceId,
              'Amount': log.amount,
              'Balance Before': log.balanceBefore,
              'Balance After': log.balanceAfter,
              'Description': log.description,
              'Status': log.status,
              'Created At': new Date(log.createdAt).toLocaleString()
          }));

          const worksheet = XLSX.utils.json_to_sheet(excelData);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Wallet Transactions');
          const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
          const filename = `wallet_transactions_${timestamp}.xlsx`;
          const filepath = path.join(__dirname, '..', 'uploads', 'exports', filename);
          await fs.mkdir(path.dirname(filepath), { recursive: true });
          XLSX.writeFile(workbook, filepath);
          res.download(filepath, filename, async (err) => {
              if (err) {
                  console.error('Download error:', err);
              }
              await fs.unlink(filepath).catch(() => {});
          });

      } catch (error) {
          console.error("Detailed error in transaction logs download:", error);
          log.error("Error downloading transaction logs:", error);
          res.status(500).send({
              messageCode: "ERR_DOWNLOAD_TRANSACTION_LOGS",
              message: "Error downloading transaction logs",
              errorDetails: error.message,
          });
      }
  }
);

module.exports = walletRouter;
