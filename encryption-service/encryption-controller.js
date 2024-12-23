const express = require('express');
const encryptionRouter = express.Router();
const encryptionService = require('./encryption-dao');
const { authenticateToken } = require('../middleware/auth-token-validator');
const Logger = require('../logger/logger');
const log = new Logger('Encryption-Controller');
const Joi = require('joi');

// Validation schema for encryption/decryption
const encryptionSchema = Joi.object({
    data: Joi.alternatives().try(
        Joi.object(), 
        Joi.array(), 
        Joi.string()
    ).required(),
    secretKey: Joi.string().optional()
});

const decryptionSchema = Joi.object({
    encryptedData: Joi.object({
        iv: Joi.string().required(),
        encryptedData: Joi.string().required()
    }).required(),
    secretKey: Joi.string().required()
});

encryptionRouter.post('/encrypt', 
    // authenticateToken,
    async (req, res) => {
        try {
            const { error } = encryptionSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALIDATION_ERROR',
                    message: error.details[0].message
                });
            }

            const encryptedData = await encryptionService.encrypt(req.body.data);

            res.send({
                messageCode: 'ENCRYPTION_SUCCESS',
                message: 'Data encrypted successfully',
                encryptedData
            });
        } catch (error) {
            log.error('Third-party encryption error:', error);
            res.status(500).send({
                messageCode: 'ENCRYPTION_ERROR',
                message: 'Failed to encrypt data'
            });
        }
});

encryptionRouter.post('/decrypt', 
    // authenticateToken,
    async (req, res) => {
        try {
            const { error } = encryptionSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALIDATION_ERROR',
                    message: error.details[0].message
                });
            }
            const decryptedData = await encryptionService.decrypt(req.body.data);
            res.send({
                messageCode: 'DECRYPTION_SUCCESS',
                message: 'Data decrypted successfully',
                decryptedData
            });
        } catch (error) {
            console.log('Third-party decryption error:', error);
            log.error('Third-party decryption error:', error);
            res.status(500).send({
                messageCode: 'DECRYPTION_ERROR',
                message: 'Failed to decrypt data'
            });
        }
});

encryptionRouter.post('/custom/encrypt', 
    // authenticateToken,
    async (req, res) => {
        try {
            const { error } = encryptionSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALIDATION_ERROR',
                    message: error.details[0].message
                });
            }

            // Generate a secret key if not provided
            const secretKey = req.body.secretKey || encryptionService.generateSecureKey();

            const encryptedData = encryptionService.customEncrypt(req.body.data, secretKey);

            res.send({
                messageCode: 'CUSTOM_ENCRYPTION_SUCCESS',
                message: 'Data encrypted successfully',
                secretKey, // Note: Only send this once!
                encryptedData
            });
        } catch (error) {
            log.error('Custom encryption error:', error);
            res.status(500).send({
                messageCode: 'CUSTOM_ENCRYPTION_ERROR',
                message: 'Failed to encrypt data'
            });
        }
});

encryptionRouter.post('/custom/decrypt', 
    // authenticateToken,
    async (req, res) => {
        try {
            const { error } = decryptionSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALIDATION_ERROR',
                    message: error.details[0].message
                });
            }

            const decryptedData = encryptionService.customDecrypt(
                req.body.encryptedData, 
                req.body.secretKey
            );

            res.send({
                messageCode: 'CUSTOM_DECRYPTION_SUCCESS',
                message: 'Data decrypted successfully',
                decryptedData
            });
        } catch (error) {
            log.error('Custom decryption error:', error);
            res.status(500).send({
                messageCode: 'CUSTOM_DECRYPTION_ERROR',
                message: 'Failed to decrypt data'
            });
        }
});

module.exports = encryptionRouter;