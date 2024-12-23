// fund-service/fund-controller.js
const express = require("express");
const fundRouter = express.Router();
const fundDao = require("./fund-dao");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const Logger = require("../logger/logger");
const log = new Logger("Fund-Controller");
const {
  authenticateToken,
  authorize,
} = require("../middleware/auth-token-validator");
const Joi = require("joi");
const walletDao = require("../wallet-service/wallet-dao");

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const dir = path.join(__dirname, "../uploads/fund-slips");
    try {
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG and PDF files are allowed."
        )
      );
    }
  },
});

// Validation schemas
const fundRequestSchema = Joi.object({
  transferType: Joi.string().valid('BANK_TO_WALLET', 'WALLET_TO_WALLET').default('BANK_TO_WALLET'),
  
  // Bank to wallet specific fields
  // bankId: Joi.number().when('transferType', {
  //   is: 'BANK_TO_WALLET', 
  //   then: Joi.required(),
  //   otherwise: Joi.optional()
  // }),
  // walletType: Joi.string().valid('SERVICE', 'PAYOUT').when('transferType', {
  //   is: 'BANK_TO_WALLET', 
  //   then: Joi.required(), 
  //   otherwise: Joi.optional()
  // }),
  // paymentMode: Joi.string().valid('IMPS', 'NEFT', 'RTGS', 'UPI').when('transferType', {
  //   is: 'BANK_TO_WALLET', 
  //   then: Joi.required(),
  //   otherwise: Joi.optional()
  // }),

  // // Wallet to wallet specific fields
  // sourceWalletType: Joi.string().valid('SERVICE', 'PAYOUT').when('transferType', {
  //   is: 'WALLET_TO_WALLET', 
  //   then: Joi.required(),
  //   otherwise: Joi.optional()
  // }),
  // targetWalletType: Joi.string().valid('SERVICE', 'PAYOUT').when('transferType', {
  //   is: 'WALLET_TO_WALLET', 
  //   then: Joi.required(),
  //   otherwise: Joi.optional()
  // }),

  // Common fields
  amount: Joi.number().positive().required(),
  paymentDate: Joi.date().iso().required(),
  referenceNumber: Joi.string().required(),
  remarks: Joi.string().optional(),
});

// Get user's current wallet information for wallet transfers
fundRouter.get("/wallets", authenticateToken, async (req, res) => {
  try {
    const userWallets = await walletDao.getUserWallets(req.user.userId);
    
    res.send({
      messageCode: "WALLETS_FETCHED",
      message: "User wallets retrieved successfully",
      wallets: userWallets.map(w => ({
        type: w.type.name,
        balance: w.wallet.balance
      }))
    });
  } catch (error) {
    log.error("Error getting user wallets:", error);
    res.status(500).send({
      messageCode: "ERR_GET_WALLETS",
      message: "Error retrieving user wallets",
    });
  }
});

// Create fund request (bank to wallet or wallet to wallet)
fundRouter.post(
  "/",
  authenticateToken,
  upload.single("paymentSlip"),
  async (req, res) => {
    try {
      // const { error } = fundRequestSchema.validate(req.body);
      // if (error) {
      //   if (req.file) {
      //     await fs.unlink(req.file.path);
      //   }
      //   return res.status(400).send({
      //     messageCode: "VALIDATION_ERROR",
      //     message: error.details[0].message,
      //   });
      // }

      const request = await fundDao.createFundRequest(
        {
          ...req.body,
          documentPath: req.file ? req.file.path : null,
        },
        req.user.userId
      );

      res.status(201).send({
        messageCode: "REQUEST_CREATED",
        message: `${req.body.transferType} fund request created successfully`,
        request,
      });
    } catch (error) {
      if (req.file) {
        await fs
          .unlink(req.file.path)
          .catch((err) => log.error("Error deleting file:", err));
      }
      log.error("Error creating fund request:", error);
      res.status(error.statusCode || 500).send({
        messageCode: error.messageCode || "ERR_CREATE_REQUEST",
        message: error.message || "Error creating fund request",
      });
    }
  }
);

// Update request status (admin only)
fundRouter.put(
  "/:requestId/status",
  authenticateToken,
//   authorize(["manage_funds"]),
  async (req, res) => {
    try {
      const { status, remarks } = req.body;
      if (!["APPROVED", "REJECTED"].includes(status)) {
        return res.status(400).send({
          messageCode: "INVALID_STATUS",
          message: "Invalid status value",
        });
      }

      if (status === "REJECTED" && !remarks) {
        return res.status(400).send({
          messageCode: "REMARKS_REQUIRED",
          message: "Remarks are required for rejection",
        });
      }

      const request = await fundDao.updateRequestStatus(
        req.params.requestId,
        status,
        req.user.userId,
        remarks
      );

      res.send({
        messageCode: "STATUS_UPDATED",
        message: `Fund request ${status.toLowerCase()} successfully`,
        request,
      });
    } catch (error) {
      log.error("Error updating fund request status:", error);
      res.status(error.statusCode || 500).send({
        messageCode: error.messageCode || "ERR_UPDATE_STATUS",
      message: error.message || "Error updating request status",
    });
  }});

// Get user's fund requests
fundRouter.get("/my-requests", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, transferType } = req.query;

    const requests = await fundDao.getFundRequests({
      userId: req.user.userId,
      status,
      transferType,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.send(requests);
  } catch (error) {
    console.log("Error getting fund requests:", error);
    log.error("Error getting fund requests:", error);
    res.status(500).send({
      messageCode: "ERR_GET_REQUESTS",
      message: "Error retrieving fund requests",
    });
  }
});

// Get all fund requests (admin only)
fundRouter.get(
  "/",
  authenticateToken,
//   authorize(["manage_funds"]),
  async (req, res) => {
    try {
      const { page = 1, limit = 10, status, transferType, userId } = req.query;

      const requests = await fundDao.getFundRequests({
        userId: userId ? parseInt(userId) : null,
        status,
        transferType,
        page: parseInt(page),
        limit: parseInt(limit),
      });

      res.send(requests);
    } catch (error) {
      log.error("Error getting fund requests:", error);
      res.status(500).send({
        messageCode: "ERR_GET_REQUESTS",
        message: "Error retrieving fund requests",
      });
    }
  }
);

// Get fund request details
fundRouter.get("/:requestId", authenticateToken, async (req, res) => {
  try {
    // For admin users, allow viewing any request
    // For regular users, only allow viewing their own requests
    const request = await fundDao.getFundRequestById(
      req.params.requestId,
      req.user.permissions.includes("manage_funds") ? null : req.user.userId
    );

    if (!request) {
      return res.status(404).send({
        messageCode: "REQUEST_NOT_FOUND",
        message: "Fund request not found",
      });
    }

    res.send({
      messageCode: "REQUEST_FETCHED",
      message: "Fund request retrieved successfully",
      request
    });
  } catch (error) {
    log.error("Error getting fund request details:", error);
    res.status(500).send({
      messageCode: "ERR_GET_REQUEST",
      message: "Error retrieving fund request details",
    });
  }
});

// Get payment slip document
fundRouter.get("/:requestId/document", authenticateToken, async (req, res) => {
  try {
    const request = await fundDao.getFundRequestById(
      req.params.requestId,
      req.user.permissions.includes("manage_funds") ? null : req.user.userId
    );

    if (!request) {
      return res.status(404).send({
        messageCode: "REQUEST_NOT_FOUND",
        message: "Fund request not found",
      });
    }

    if (!request.documentPath) {
      return res.status(404).send({
        messageCode: "DOCUMENT_NOT_FOUND",
        message: "No payment slip found for this request",
      });
    }

    res.sendFile(request.documentPath);
  } catch (error) {
    log.error("Error getting payment slip:", error);
    res.status(500).send({
      messageCode: "ERR_GET_DOCUMENT",
      message: "Error retrieving payment slip",
    });
  }
});

// Get fund request statistics (admin only)
fundRouter.get(
  "/stats/summary",
  authenticateToken,
//   authorize(["manage_funds"]),
  async (req, res) => {
    try {
      const stats = await fundDao.getFundRequestStats();
      res.send({
        messageCode: "STATS_FETCHED",
        message: "Fund request statistics retrieved successfully",
        stats
      });
    } catch (error) {
      log.error("Error getting fund request statistics:", error);
      res.status(500).send({
        messageCode: "ERR_GET_STATS",
        message: "Error retrieving fund request statistics",
      });
    }
  }
);

module.exports = fundRouter;
