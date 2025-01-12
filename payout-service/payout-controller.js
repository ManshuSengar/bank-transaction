// payout-service/payout-controller.js
const express = require("express");
const payoutRouter = express.Router();
const payoutDao = require("./payout-dao");
const userDao = require("../user-service/user-dao");
const apiTokenDao = require("../api-token-service/api-token-dao");
const Logger = require("../logger/logger");
const log = new Logger("Payout-Controller");
const Joi = require("joi");
const uniqueIdDao = require("../unique-service/unique-id-dao");
const { DatabaseError } = require("pg");
const { authenticateToken } = require("../middleware/auth-token-validator");
const telegramDao = require("../telegram-service/telegram-dao");
const walletDao = require("../wallet-service/wallet-dao");
const apiConfigDao=require("../api-config-service/api-config-dao");
const axios=require("axios");
// Validation Schemas
const accountValidateSchema = Joi.object({
  clientId: Joi.string().required(), // username
  secretKey: Joi.string().required(), // token
  number: Joi.string()
    .pattern(/^\d{10}$/)
    .required(),
  accountNo: Joi.string().pattern(/^\d+$/).required(),
  ifscCode: Joi.string()
    .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .required(),
  clientOrderId: Joi.string().required(),
});

const payoutSchema = Joi.object({
  // clientId: Joi.string().required(),     // username
  // secretKey: Joi.string().required(),    // token
  // number: Joi.string().pattern(/^\d{10}$/).required(),
  // amount: Joi.string().required(),
  // transferMode: Joi.string().valid('IMPS', 'NEFT', 'RTGS').required(),
  // accountNo: Joi.string().required(),
  // ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(),
  // beneficiaryName: Joi.string().required(),
  // clientOrderId: Joi.string().required()
});

const statusCheckSchema = Joi.object({
  clientId: Joi.string().required(), // username
  secretKey: Joi.string().required(), // token
  clientOrderId: Joi.string().required(),
});

const balanceCheckSchema = Joi.object({
  clientId: Joi.string().required(), // username
  secretKey: Joi.string().required(), // token
});

function handleDatabaseError(
  error,
  req,
  res,
  defaultMessage = "Database error"
) {
  log.error("Database Error:", error);

  // PostgreSQL unique constraint violation
  if (error.code === "23505") {
    return res.status(409).send({
      statusCode: 0,
      message: "Duplicate client order ID or transaction already exists",
      clientOrderId: req.body.clientOrderId,
      orderId: null,
      beneficiaryName: null,
      utr: null,
      status: null,
    });
  }

  if (error.code === "23503") {
    return res.status(400).send({
      statusCode: 0,
      message:
        "Invalid reference: User, scheme, or API configuration not found",
      clientOrderId: req.body.clientOrderId,
      orderId: null,
      beneficiaryName: null,
      utr: null,
      status: null,
    });
  }

  return res.status(500).send({
    statusCode: 0,
    message: defaultMessage,
    clientOrderId: req.body.clientOrderId,
    orderId: null,
    beneficiaryName: null,
    utr: null,
    status: null,
  });
}

// Account Validation Endpoint
payoutRouter.post("/account-validate", async (req, res) => {
  try {
    const { error } = accountValidateSchema.validate(req.body);
    if (error) {
      return res.status(400).send({
        statusCode: 0,
        message: error.details[0].message,
        clientOrderId: req.body.clientOrderId,
        orderId: null,
        beneficiaryName: null,
        utr: null,
        status: null,
      });
    }

    // Validate user and token
    const user = await userDao.getUserByUsername(req.body.clientId);
    if (!user) {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid username",
        clientOrderId: req.body.clientOrderId,
        orderId: null,
        beneficiaryName: null,
        utr: null,
        status: null,
      });
    }

    const apiToken = await apiTokenDao.getTokenByValue(req.body.secretKey);
    if (!apiToken || apiToken.status !== "ACTIVE") {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid token",
        clientOrderId: req.body.clientOrderId,
        orderId: null,
        beneficiaryName: null,
        utr: null,
        status: null,
      });
    }

    // Generate internal unique ID
    // const uniqueIdRecord = await uniqueIdDao.createUniqueIdRecord(
    //     user.id,
    //     req.body.clientOrderId,
    //     0  // amount is not needed for validation
    // );

    const result = await payoutDao.verifyAccount(
      user.id,
      {
        phoneNumber: req.body.number,
        accountNumber: req.body.accountNo,
        ifscCode: req.body.ifscCode,
        clientOrderId: uniqueIdRecord.clientOrderId,
        originalClientOrderId: req.body.clientOrderId,
        ipAddress: req.ip,
      },
      req.body.secretKey
    );

    res.send({
      statusCode: result.vendorResponse.success ? 1 : 0, // Directly use the success flag
      message: result.vendorResponse.message || null,
      clientOrderId: req.body.clientOrderId,
      orderId: result.vendorResponse.orderId || null,
      beneficiaryName: result.vendorResponse.success
        ? result.vendorResponse.beneficiaryName
        : null,
      utr: "NA",
      status: result.vendorResponse.success ? 1 : 0, // Vendor status code
    });
  } catch (error) {
    if (error instanceof DatabaseError) {
      return handleDatabaseError(
        error,
        req,
        res,
        "Error in account validation"
      );
    }

    log.error("Error in account validation:", error);
    res.status(500).send({
      statusCode: 0,
      message: error.message || "Internal server error",
      clientOrderId: req.body.clientOrderId,
      orderId: null,
      beneficiaryName: null,
      utr: null,
      status: null,
    });
  }
});

payoutRouter.post("/payout", async (req, res) => {
  try {
    // const { error } = payoutSchema.validate(req.body);
    // if (error) {
    //     return res.status(400).send({
    //         statusCode: 0,
    //         message: error.details[0].message,
    //         clientOrderId: req.body.clientOrderId,
    //         orderId: null,
    //         beneficiaryName: null,
    //         utr: null,
    //         status: null
    //     });
    // }
    const user = await userDao.getUserByUsername(req.body.clientId);
    if (!user) {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid username",
        clientOrderId: req.body.clientOrderId,
        orderId: null,
        beneficiaryName: null,
        utr: null,
        status: null,
      });
    }

    const apiToken = await apiTokenDao.getTokenByValue(req.body.secretKey);
    if (!apiToken || apiToken[0].status !== "ACTIVE") {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid token",
        clientOrderId: req.body.clientOrderId,
        orderId: null,
        beneficiaryName: null,
        utr: null,
        status: null,
      });
    }

    const result = await payoutDao.initiatePayout(
      user.id,
      {
        ...req.body,
        accountNumber: req.body.accountNo,
        amount: parseFloat(req.body.amount),
        clientOrderId: req.body.clientOrderId,
        ipAddress: req.ip,
      },
      req.body.secretKey
    );

    const statusCode =
      result.vendorResponse.statusCode === 1
        ? 1
        : result.vendorResponse.statusCode === 0
        ? 0
        : 2;

    res.send({
      statusCode: statusCode,
      message:
        statusCode === 1 ? "success" : statusCode === 0 ? "failed" : "initiate",
      clientOrderId: req.body.clientOrderId,
      orderId: result.transaction.orderId,
      beneficiaryName: result.transaction.beneficiaryName,
      utr: result.transaction.utrNumber,
      status: statusCode,
      amount: result.transaction.amount,
    });
  } catch (error) {
    console.log("error--> ", error);

    if (error instanceof DatabaseError) {
      return handleDatabaseError(
        error,
        req,
        res,
        "Error in account validation"
      );
    }
    log.error("Error initiating payout:", error);
    res.status(500).send({
      statusCode: 0,
      message: error.message || "Internal server error",
      clientOrderId: req.body.clientOrderId,
      orderId: null,
      beneficiaryName: null,
      utr: null,
      status: null,
    });
  }
});

payoutRouter.get("/user/transactions", authenticateToken, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      status,
      search,
      minAmount,
      maxAmount,
      page = 1,
      limit = 10,
    } = req.query;

    const transactions = await payoutDao.getFilteredTransactions({
      userId: req.user.userId,
      startDate,
      endDate,
      status,
      search,
      minAmount: minAmount ? parseFloat(minAmount) : null,
      maxAmount: maxAmount ? parseFloat(maxAmount) : null,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.send({
      messageCode: "TRANSACTIONS_FETCHED",
      message: "Transactions retrieved successfully",
      data: transactions.data.map((transaction) => ({
        id: transaction.id,
        clientOrderId: transaction.clientOrderId,
        amount: transaction.amount,
        beneficiaryName: transaction.beneficiaryName,
        accountNumber: transaction.accountNumber,
        ifscCode: transaction.ifscCode,
        utrNumber: transaction.utrNumber,
        status: transaction.status,
        chargeValue: transaction.chargeValue,
        gstAmount: transaction.gstAmount,
        createdAt: transaction.createdAt,
      })),
      pagination: transactions.pagination,
      summary: transactions.summary,
    });
  } catch (error) {
    log.error("Error getting filtered transactions:", error);
    res.status(500).send({
      messageCode: "ERR_GET_TRANSACTIONS",
      message: "Error retrieving transactions",
    });
  }
});

payoutRouter.get("/admin/transactions", authenticateToken, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      status,
      search,
      minAmount,
      maxAmount,
      page = 1,
      limit = 10,
    } = req.query;

    const transactions = await payoutDao.getAdminFilteredTransactions({
      startDate,
      endDate,
      status,
      search,
      minAmount: minAmount ? parseFloat(minAmount) : null,
      maxAmount: maxAmount ? parseFloat(maxAmount) : null,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.send({
      messageCode: "ADMIN_TRANSACTIONS_FETCHED",
      message: "All payout transactions retrieved successfully",
      data: transactions.data.map((transaction) => ({
        id: transaction.id,
        clientOrderId: transaction.clientOrderId,
        orderId: transaction.orderId,
        amount: transaction.amount,
        transferMode: transaction.transferMode,
        beneficiaryName: transaction.beneficiaryName,
        accountNumber: transaction.accountNumber,
        ifscCode: transaction.ifscCode,
        utrNumber: transaction.utrNumber,
        status: transaction.status,
        chargeValue: transaction.chargeValue,
        gstAmount: transaction.gstAmount,
        createdAt: transaction.createdAt,
        userId: transaction.user.id,
        username: transaction.user.username,
        firstname: transaction.user.firstname,
        lastname: transaction.user.lastname,
        emailId: transaction.user.emailId,
        phoneNo: transaction.user.phoneNo,
      })),
      pagination: transactions.pagination,
      summary: transactions.summary,
    });
  } catch (error) {
    console.log("error--> ", error);
    log.error("Error getting admin transactions:", error);
    res.status(500).send({
      messageCode: "ERR_GET_ADMIN_TRANSACTIONS",
      message: "Error retrieving admin payout transactions",
    });
  }
});

payoutRouter.get(
  "/admin/transactions/download",
  authenticateToken,
  async (req, res) => {
    try {
      const { startDate, endDate, status, search, minAmount, maxAmount } =
        req.query;

      const transactions = await payoutDao.getAdminFilteredTransactions({
        startDate,
        endDate,
        status,
        search,
        minAmount: minAmount ? parseFloat(minAmount) : null,
        maxAmount: maxAmount ? parseFloat(maxAmount) : null,
        page: 1,
        limit: 100000,
      });

      const excelData = transactions.data.map((transaction) => ({
        "Transaction ID": transaction.clientOrderId,
        "Order ID": transaction.orderId,
        Amount: transaction.amount,
        "Transfer Mode": transaction.transferMode,
        "Beneficiary Name": transaction.beneficiaryName,
        "Account Number": transaction.accountNumber,
        "IFSC Code": transaction.ifscCode,
        "UTR Number": transaction.utrNumber,
        Status: transaction.status,
        "Charge Value": transaction.chargeValue,
        "GST Amount": transaction.gstAmount,
        "Created At": new Date(transaction.createdAt).toLocaleString(),
        Username: transaction.user.username,
        "Full Name": `${transaction.user.firstname} ${transaction.user.lastname}`,
        Email: transaction.user.emailId,
        Phone: transaction.user.phoneNo,
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Payout Transactions");

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `payout_transactions_${timestamp}.xlsx`;
      const filepath = path.join(
        __dirname,
        "..",
        "uploads",
        "exports",
        filename
      );

      await fs.mkdir(path.dirname(filepath), { recursive: true });
      XLSX.writeFile(workbook, filepath);

      res.download(filepath, filename, async (err) => {
        if (err) {
          log.error("Download error:", err);
        }
        await fs.unlink(filepath).catch(() => {});
      });
    } catch (error) {
      log.error("Error downloading transactions:", error);
      res.status(500).send({
        messageCode: "ERR_DOWNLOAD_TRANSACTIONS",
        message: "Error downloading transactions",
      });
    }
  }
);

payoutRouter.post(
  "/admin/check-status",
  authenticateToken,
  async (req, res) => {
    try {
      const { clientOrderId } = req.body;

      if (!clientOrderId) {
        return res.status(400).send({
          messageCode: "VALIDATION_ERROR",
          message: "Client Order ID is required",
        });
      }

      const transaction = await payoutDao.getTransactionByClientOrderId(
        clientOrderId
      );
      if (!transaction) {
        return res.status(404).send({
          messageCode: "TRANSACTION_NOT_FOUND",
          message: "Transaction not found",
        });
      }

      const result = await payoutDao.checkStatusWithVendor(transaction);

      const statusMapping = {
        SUCCESS: "success",
        FAILED: "failed",
        PENDING: "pending",
        REVERSED: "reversed",
      };

      res.send({
        messageCode: "STATUS_CHECKED",
        message: `Transaction status: ${statusMapping[result.status]}`,
        data: {
          clientOrderId: transaction.clientOrderId,
          orderId: transaction.orderId,
          amount: transaction.amount,
          beneficiaryName: transaction.beneficiaryName,
          previousStatus: transaction.status,
          currentStatus: result.status,
          utrNumber: result.utrNumber,
          statusDescription: result.description,
        },
      });
    } catch (error) {
      console.log("error--> ", error);
      log.error("Error checking status:", error);
      res.status(500).send({
        messageCode: "ERR_CHECK_STATUS",
        message: "Error checking transaction status",
      });
    }
  }
);

// Process vendor callback
payoutRouter.post("/callback", async (req, res) => {
  try {
    const callbackData = req.body;
    if (!callbackData || !callbackData.ClientOrderId) {
      return res.status(400).send({
        StatusCode: 0,
        Message: "Invalid callback data",
      });
    }

    await payoutDao.processCallback(callbackData);

    // Return success response in the expected format
    res.send({
      StatusCode: 1,
      Message: "Callback processed successfully",
    });
  } catch (error) {
    log.error("Error processing callback:", error);
    // Still return success to vendor but log the error
    res.send({
      StatusCode: 1,
      Message: "Callback acknowledged",
    });
  }
});

payoutRouter.post("/check-balance", async (req, res) => {
  try {
    const { error } = balanceCheckSchema.validate(req.body);
    if (error) {
      return res.status(400).send({
        statusCode: 0,
        message: error.details[0].message,
        balance: null,
      });
    }

    const user = await userDao.getUserByUsername(req.body.clientId);
    if (!user) {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid username",
        balance: null,
      });
    }

    const apiToken = await apiTokenDao.getTokenByValue(req.body.secretKey);
    if (!apiToken || apiToken[0].status !== "ACTIVE") {
      return res.status(401).send({
        statusCode: 0,
        message: "Invalid token",
        balance: null,
      });
    }

    const userWallets = await walletDao.getUserWallets(user.id);
    const payoutWallet = userWallets.find((w) => w.type.name === "PAYOUT");

    if (!payoutWallet) {
      return res.status(404).send({
        statusCode: 0,
        message: "Payout wallet not found",
        balance: null,
      });
    }

    res.send({
      statusCode: 1,
      message: "Balance retrieved successfully",
      balance: payoutWallet.wallet.balance || 0,
    });
  } catch (error) {
    log.error("Error checking balance:", error);
    res.status(500).send({
      statusCode: 0,
      message: "Error retrieving balance",
      balance: null,
    });
  }
});

payoutRouter.get(
  "/admin/check-balance",
  authenticateToken,
  async (req, res) => {
    try {
      const apiConfig = await apiConfigDao.getDefaultApiConfig(2);
      if (!apiConfig) {
        throw new Error("No API configuration found for Payout");
      }
      const response = await axios.post(
        `${apiConfig.baseUrl}/api/api/api-module/payout/balance`,
        {
          clientId: process.env.PAYOUT_CLIENT_ID,
          secretKey: process.env.PAYOUT_SECRET_KEY,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.statusCode !== 1) {
        throw new Error(
          response.data.message || "Failed to fetch vendor balance"
        );
      }
      const balance = response.data.balance;

      if (balance < 1000) {
        const alertMessage =
          `🚨 *LOW VENDOR BALANCE ALERT*\n\n` +
          `*Current Balance:* ₹${balance.toLocaleString("en-IN")}\n` +
          `*Status:* Critical - Below minimum threshold\n` +
          `*Action Required:* Immediate top-up needed\n\n` +
          `Please add funds to avoid service interruption.`;

        await telegramDao.sendMessage(alertMessage);
      }

      res.send({
        messageCode: "VENDOR_BALANCE_FETCHED",
        message: "Vendor balance retrieved successfully",
        balance: balance,
        status: balance < 500 ? "LOW" : "SUFFICIENT",
      });
    } catch (error) {
      console.log("Error checking vendor balance:", error);
      log.error("Error checking vendor balance:", error);
      res.status(500).send({
        messageCode: "ERR_CHECK_VENDOR_BALANCE",
        message: error.message || "Error retrieving vendor balance",
      });
    }
  }
);

module.exports = payoutRouter;
