// callback-service/callback-process-controller.js
const express = require('express');
const callbackProcessRouter = express.Router();
const callbackProcessDao = require('./callback-process-dao');
const Logger = require('../logger/logger');
const log = new Logger('Callback-Process-Controller');
const Joi = require('joi');
const { authenticateToken } = require('../middleware/auth-token-validator');

// Validation schema
const callbackSchema = Joi.object({
    data: Joi.string().required() // Encrypted payload
});

// Callback Processing Endpoint
callbackProcessRouter.post('/bizzpaa', async (req, res) => {
    try {
        // Validate input
        const { error } = callbackSchema.validate(req.body);
        if (error) {
            return res.status(400).send({
                messageCode: 'VALIDATION_ERROR',
                message: error.details[0].message
            });
        }

        const { data } = req.body;
        console.log("data--> ",data);
        // Log system callback
        const { systemLog, decryptedData } = await callbackProcessDao.logSystemCallback(data);

        // Process user callback
        const userCallback = await callbackProcessDao.processUserCallback(decryptedData);

        // Respond with success
        res.send({
            messageCode: 'CALLBACK_PROCESSED',
            message: 'Callback processed successfully',
            systemLogId: systemLog.id,
            userCallbackLogId: userCallback?.id
        });
    } catch (error) {
        log.error('Error processing callback:', error);
        res.status(error.statusCode || 500).send({
            messageCode: error.messageCode || 'ERR_CALLBACK_PROCESS',
            message: error.message || 'Error processing callback'
        });
    }
});


callbackProcessRouter.get('/system-logs',async (req, res) => {
    try {
        const {
            userId,
            startDate,
            endDate,
            status,
            limit = 50,
            offset = 0
        } = req.query;

        const filters = {};
        
        if (userId) {
            const userIdNum = parseInt(userId);
            if (isNaN(userIdNum)) {
                return res.status(400).send({
                    messageCode: 'INVALID_USER_ID',
                    message: 'Invalid user ID provided'
                });
            }
            filters.userId = userIdNum;
        }

        if (startDate) {
            if (!Date.parse(startDate)) {
                return res.status(400).send({
                    messageCode: 'INVALID_START_DATE',
                    message: 'Invalid start date format'
                });
            }
            filters.startDate = new Date(startDate);
        }

        if (endDate) {
            if (!Date.parse(endDate)) {
                return res.status(400).send({
                    messageCode: 'INVALID_END_DATE',
                    message: 'Invalid end date format'
                });
            }
            filters.endDate = new Date(endDate);
        }

        if (status) {
            filters.status = status.toUpperCase();
        }

        filters.limit = Math.min(parseInt(limit) || 50, 100); // Max 100 records
        filters.offset = parseInt(offset) || 0;

        const systemLogs = await callbackProcessDao.getFilteredSystemCallbackLogs(filters);
        
        res.send({
            messageCode: 'SYSTEM_LOGS_RETRIEVED',
            message: 'System callback logs retrieved successfully',
            data: systemLogs.logs,
            pagination: {
                total: systemLogs.total,
                limit: filters.limit,
                offset: filters.offset
            }
        });

    } catch (error) {
        log.error('Error retrieving filtered system callback logs:', error);
        res.status(error.statusCode || 500).send({
            messageCode: error.messageCode || 'ERR_FETCH_SYSTEM_LOGS',
            message: error.message || 'Error retrieving system callback logs'
        });
    }
});

callbackProcessRouter.get('/user-logs', authenticateToken,async (req, res) => {
    try {
        // Get userId from authentication (assuming it's passed in req.user.id)
        const userId = req.user.id;
        
        // Get query parameters with defaults
        const {
            startDate,
            endDate,
            limit = 50,
            offset = 0
        } = req.query;

        // Validate query parameters
        const filters = {
            userId  // Adding authenticated userId to filters
        };
        
        if (startDate) {
            if (!Date.parse(startDate)) {
                return res.status(400).send({
                    messageCode: 'INVALID_START_DATE',
                    message: 'Invalid start date format'
                });
            }
            filters.startDate = new Date(startDate);
        }

        if (endDate) {
            if (!Date.parse(endDate)) {
                return res.status(400).send({
                    messageCode: 'INVALID_END_DATE',
                    message: 'Invalid end date format'
                });
            }
            filters.endDate = new Date(endDate);
        }

        filters.limit = Math.min(parseInt(limit) || 50, 100); // Max 100 records
        filters.offset = parseInt(offset) || 0;

        const userLogs = await callbackProcessDao.getFilteredUserCallbackLogs(filters);
        
        res.send({
            messageCode: 'USER_LOGS_RETRIEVED',
            message: 'User callback logs retrieved successfully',
            data: userLogs.logs,
            pagination: {
                total: userLogs.total,
                limit: filters.limit,
                offset: filters.offset
            }
        });

    } catch (error) {
        log.error('Error retrieving filtered user callback logs:', error);
        res.status(error.statusCode || 500).send({
            messageCode: error.messageCode || 'ERR_FETCH_USER_LOGS',
            message: error.message || 'Error retrieving user callback logs'
        });
    }
});


module.exports = callbackProcessRouter;