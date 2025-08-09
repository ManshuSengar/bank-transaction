const express = require('express');
const bankRouter = express.Router();
const bankDao = require('./bank-dao');
const { authenticateToken, authorize } = require('../middleware/auth-token-validator');
const Logger = require('../logger/logger');
const log = new Logger('Bank-Controller');
const Joi = require('joi');

const bankSchema = Joi.object({
    name: Joi.string().required(),
    accountNumber: Joi.string().pattern(/^\d+$/).required(),
    ifsc: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(),
    branch: Joi.string().required(),
    securityPin: Joi.string().min(4).max(6).pattern(/^\d+$/),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE')
});

bankRouter.post('/',
    authenticateToken,
    async (req, res) => {
        try {
            const { error } = bankSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALIDATION_ERROR',
                    message: error.details[0].message
                });
            }

            const bank = await bankDao.addBank({
                ...req.body,
                createdBy: req.user.userId
            });

            res.status(201).send({
                messageCode: 'BANK_ADDED',
                message: 'Bank account added successfully',
                bank
            });
        } catch (error) {
            log.error('Error adding bank:', error);
            res.status(500).send({
                messageCode: 'ERR_ADD_BANK',
                message: 'Error adding bank account'
            });
        }
});

// Get all bank accounts with pagination and filtering
bankRouter.get('/',
    authenticateToken,
    // authorize(['view_banks', 'manage_banks']),
    async (req, res) => {
        try {
            const { page = 1, limit = 10, status, search } = req.query;
            const banks = await bankDao.getBanks({
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                search
            });
            res.send(banks);
        } catch (error) {
            log.error('Error getting banks:', error);
            res.status(500).send({
                messageCode: 'ERR_GET_BANKS',
                message: 'Error retrieving bank accounts'
            });
        }
});

// Update bank account status
bankRouter.put('/:id/status',
    authenticateToken,
    async (req, res) => {
        try {
            const { status } = req.body;
            if (!['ACTIVE', 'INACTIVE'].includes(status)) {
                return res.status(400).send({
                    messageCode: 'INVALID_STATUS',
                    message: 'Invalid status value'
                });
            }

            const bank = await bankDao.updateBankStatus(req.params.id, status);
            res.send({
                messageCode: 'STATUS_UPDATED',
                message: 'Bank status updated successfully',
                bank
            });
        } catch (error) {
            log.error('Error updating bank status:', error);
            res.status(500).send({
                messageCode: 'ERR_UPDATE_STATUS',
                message: 'Error updating bank status'
            });
        }
});

bankRouter.put('/:id',
    authenticateToken,
    // authorize(['manage_banks']),
    async (req, res) => {
        try {
            const { error } = bankSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALIDATION_ERROR',
                    message: error.details[0].message
                });
            }

            const bankId = parseInt(req.params.id);
            if (isNaN(bankId)) {
                return res.status(400).send({
                    messageCode: 'INVALID_ID',
                    message: 'Invalid bank ID'
                });
            }

            // Check if bank exists
            const existingBank = await bankDao.getBankById(bankId);
            if (!existingBank) {
                return res.status(404).send({
                    messageCode: 'BANK_NOT_FOUND',
                    message: 'Bank not found'
                });
            }

            const bank = await bankDao.updateBank(bankId, {
                ...req.body,
                updatedAt: new Date()
            });

            // Log the operation
            await bankDao.logBankOperation({
                bankId,
                operation: 'UPDATE_BANK',
                status: 'SUCCESS',
                details: JSON.stringify(req.body),
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                performedBy: req.user.userId
            });

            res.send({
                messageCode: 'BANK_UPDATED',
                message: 'Bank account updated successfully',
                bank
            });
        } catch (error) {
            console.log('Error updating bank:', error);
            log.error('Error updating bank:', error);
            res.status(500).send({
                messageCode: 'ERR_UPDATE_BANK',
                message: 'Error updating bank account'
            });
        }
});

module.exports = bankRouter;

