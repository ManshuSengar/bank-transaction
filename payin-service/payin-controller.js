// payin-service/payin-controller.js
const express = require('express');
const payinRouter = express.Router();
const payinDao = require('./payin-dao');
const apiTokenDao = require('../api-token-service/api-token-dao');
const encryptionService = require('../encryption-service/encryption-dao');
const userDao = require('../user-service/user-dao');
const Logger = require('../logger/logger');
const log = new Logger('Payin-Controller');
const Joi = require('joi');
const { authenticateToken } = require('../middleware/auth-token-validator');

// Validation Schema
const generateQRSchema = Joi.object({
    username: Joi.string().required(),
    token: Joi.string().required(), // API Token for authentication
    data: Joi.string().required() // Encrypted data string
});

// Public QR Generation Endpoint
payinRouter.post('/qr', async (req, res) => {
    try {
        console.log("/qr--> ",req.body);
        const { error } = generateQRSchema.validate(req.body);
        if (error) {
            return res.status(400).send({
                messageCode: 'VALIDATION_ERROR',
                message: error.details[0].message
            });
        }

        const { username, token, data } = req.body;

        // Validate API Token
        const apiToken = await apiTokenDao.getTokenByValue(token);
        console.log("apiToken--> ",apiToken);
        if (!apiToken[0] || apiToken[0].status !== 'ACTIVE') {
            return res.status(401).send({
                messageCode: 'INVALID_TOKEN',
                message: 'Invalid or inactive API token'
            });
        }

        // Validate token belongs to the user
        const user = await userDao.getUserByUsername(username);
        console.log("user--> ",user);
        if (!user || apiToken[0].userId !== user.id) {
            return res.status(403).send({
                messageCode: 'TOKEN_USER_MISMATCH',
                message: 'Token does not belong to the specified user'
            });
        }

        // Decrypt the data
        let decryptedData;
        try {
            decryptedData = await encryptionService.decrypt(data);
        } catch (decryptError) {
            return res.status(400).send({
                messageCode: 'DECRYPTION_ERROR',
                message: 'Failed to decrypt payload'
            });
        }

        // Validate decrypted data structure
        if (!decryptedData.amount || !decryptedData.uniqueid) {
            return res.status(400).send({
                messageCode: 'INVALID_PAYLOAD',
                message: 'Payload must contain amount and uniqueid'
            });
        }

        // Generate QR for the user
        const result = await payinDao.generateQR(
            user.id, 
            decryptedData.amount, 
            decryptedData.uniqueid
        );

        res.status(201).send({
            messageCode: 'QR_GENERATED',
            message: 'QR generated successfully',
            uniqueId: result.transaction.uniqueId,
            qr: result.transaction.vendorResponse.qr,
            createdAt: result.transaction.createdAt,
            updatedAt: result.transaction.updatedAt
        });
    } catch (error) {
        log.error('Error generating public QR:', error);
        res.status(error.statusCode || 500).send({
            messageCode: error.messageCode || 'ERR_GENERATE_QR',
            message: error.message || 'Error generating QR'
        });
    }
});

// Verify Transaction (Public Endpoint)
payinRouter.post('/verify', async (req, res) => {
    try {
        const { transactionId, username, token } = req.body;

        // Validate input
        if (!transactionId || !username || !token) {
            return res.status(400).send({
                messageCode: 'VALIDATION_ERROR',
                message: 'Transaction ID, username, and token are required'
            });
        }

        // Validate API Token
        const apiToken = await apiTokenDao.getTokenByValue(token);
        if (!apiToken || apiToken.status !== 'ACTIVE') {
            return res.status(401).send({
                messageCode: 'INVALID_TOKEN',
                message: 'Invalid or inactive API token'
            });
        }

        // Validate token belongs to the user
        const user = await userDao.getUserByUsername(username);
        if (!user || apiToken.userId !== user.id) {
            return res.status(403).send({
                messageCode: 'TOKEN_USER_MISMATCH',
                message: 'Token does not belong to the specified user'
            });
        }

        const result = await payinDao.verifyTransaction(transactionId);

        res.send({
            messageCode: 'TRANSACTION_VERIFIED',
            message: 'Transaction details retrieved',
            transaction: result
        });
    } catch (error) {
        log.error('Error verifying transaction:', error);
        res.status(500).send({
            messageCode: 'ERR_VERIFY_TRANSACTION',
            message: 'Error verifying transaction'
        });
    }
});

payinRouter.get('/transactions', async (req, res) => {
    try {
        const { username, token, page, limit, status } = req.query;

        if (!username || !token) {
            return res.status(400).send({
                messageCode: 'VALIDATION_ERROR',
                message: 'Username and token are required'
            });
        }

        const apiToken = await apiTokenDao.getTokenByValue(token);
        if (!apiToken || apiToken.status !== 'ACTIVE') {
            return res.status(401).send({
                messageCode: 'INVALID_TOKEN',
                message: 'Invalid or inactive API token'
            });
        }

        const user = await userDao.getUserByUsername(username);
        if (!user || apiToken.userId !== user.id) {
            return res.status(403).send({
                messageCode: 'TOKEN_USER_MISMATCH',
                message: 'Token does not belong to the specified user'
            });
        }

        const transactions = await payinDao.getUserPayinTransactions(
            user.id,
            { 
                page: parseInt(page) || 1, 
                limit: parseInt(limit) || 10, 
                status 
            }
        );

        res.send({
            messageCode: 'TRANSACTIONS_FETCHED',
            message: 'User payin transactions retrieved successfully',
            ...transactions
        });
    } catch (error) {
        log.error('Error getting transactions:', error);
        res.status(500).send({
            messageCode: 'ERR_GET_TRANSACTIONS',
            message: 'Error retrieving transactions'
        });
    }
});

// payin-controller.js

payinRouter.get('/user/transactions', authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.user.userId);
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

        const userDetails = await userDao.getUserByUsername(req.user.username);

        const transactions = await payinDao.getFilteredTransactions({
            userId,
            startDate,
            endDate,
            status,
            search,
            minAmount: minAmount ? parseFloat(minAmount) : null,
            maxAmount: maxAmount ? parseFloat(maxAmount) : null,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.send({
            messageCode: 'TRANSACTIONS_FETCHED',
            message: 'Transactions retrieved successfully',
            user: {
                id: userDetails.id,
                firstname: userDetails.firstname,
                lastname: userDetails.lastname,
                username: userDetails.username,
                emailId: userDetails.emailId,
                phoneNo: userDetails.phoneNo,
                role: userDetails.role,
                address: userDetails.address
            },
            ...transactions
        });

    } catch (error) {
        console.log('Error getting filtered transactions:', error);
        log.error('Error getting filtered transactions:', error);
        res.status(500).send({
            messageCode: 'ERR_GET_TRANSACTIONS',
            message: 'Error retrieving transactions'
        });
    }
});

module.exports = payinRouter;