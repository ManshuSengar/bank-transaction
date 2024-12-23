const express = require('express');
const apiConfigRouter = express.Router();
const apiConfigDao = require('./api-config-dao');
const { apiConfigSchema } = require('../scheme-service/scheme-schema-model');
const Logger = require('../logger/logger');
const log = new Logger('API-Config-Controller');
const { authenticateToken, authorize } = require('../middleware/auth-token-validator');

// Create new API configuration
apiConfigRouter.post('/',
    authenticateToken,
    // authorize(['manage_apis']),
    async (req, res) => {
        try {
            const { error } = apiConfigSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALIDATION_ERROR',
                    message: error.details[0].message
                });
            }

            const apiConfig = await apiConfigDao.createApiConfig({
                ...req.body,
                createdBy: req.user.userId
            });

            res.status(201).send({
                messageCode: 'API_CONFIG_CREATED',
                message: 'API configuration created successfully',
                apiConfig
            });
        } catch (error) {
            log.error('Error creating API config:', error);
            res.status(500).send({
                messageCode: 'ERR_CREATE_API_CONFIG',
                message: 'Error creating API configuration'
            });
        }
});

// Update API configuration
apiConfigRouter.put('/:id',
    authenticateToken,
    // authorize(['manage_apis']),
    async (req, res) => {
        try {
            const { error } = apiConfigSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALIDATION_ERROR',
                    message: error.details[0].message
                });
            }

            const apiConfig = await apiConfigDao.updateApiConfig(req.params.id, req.body);
            
            if (!apiConfig) {
                return res.status(404).send({
                    messageCode: 'API_CONFIG_NOT_FOUND',
                    message: 'API configuration not found'
                });
            }

            res.send({
                messageCode: 'API_CONFIG_UPDATED',
                message: 'API configuration updated successfully',
                apiConfig
            });
        } catch (error) {
            log.error('Error updating API config:', error);
            res.status(500).send({
                messageCode: 'ERR_UPDATE_API_CONFIG',
                message: 'Error updating API configuration'
            });
        }
});

// Get all API configurations with filters
apiConfigRouter.get('/',
    authenticateToken,
    // authorize(['view_apis', 'manage_apis']),
    async (req, res) => {
        try {
            const { page, limit, productId, status, search } = req.query;
            const configs = await apiConfigDao.getApiConfigs({
                page: parseInt(page),
                limit: parseInt(limit),
                productId: productId ? parseInt(productId) : null,
                status,
                search
            });

            res.send(configs);
        } catch (error) {
            log.error('Error getting API configs:', error);
            res.status(500).send({
                messageCode: 'ERR_GET_API_CONFIGS',
                message: 'Error retrieving API configurations'
            });
        }
});

// Get API configuration by ID
apiConfigRouter.get('/:id',
    authenticateToken,
    // authorize(['view_apis', 'manage_apis']),
    async (req, res) => {
        try {
            const config = await apiConfigDao.getApiConfigById(req.params.id);
            
            if (!config) {
                return res.status(404).send({
                    messageCode: 'API_CONFIG_NOT_FOUND',
                    message: 'API configuration not found'
                });
            }

            res.send(config);
        } catch (error) {
            log.error('Error getting API config:', error);
            res.status(500).send({
                messageCode: 'ERR_GET_API_CONFIG',
                message: 'Error retrieving API configuration'
            });
        }
});

// Update API status (enable/disable)
apiConfigRouter.put('/:id/status',
    authenticateToken,
    // authorize(['manage_apis']),
    async (req, res) => {
        try {
            const { status } = req.body;
            if (!['ACTIVE', 'INACTIVE'].includes(status)) {
                return res.status(400).send({
                    messageCode: 'INVALID_STATUS',
                    message: 'Invalid status value. Must be ACTIVE or INACTIVE'
                });
            }

            const config = await apiConfigDao.updateApiStatus(req.params.id, status);
            
            if (!config) {
                return res.status(404).send({
                    messageCode: 'API_CONFIG_NOT_FOUND',
                    message: 'API configuration not found'
                });
            }

            res.send({
                messageCode: 'STATUS_UPDATED',
                message: 'API status updated successfully',
                apiConfig: config
            });
        } catch (error) {
            log.error('Error updating API status:', error);
            res.status(500).send({
                messageCode: 'ERR_UPDATE_STATUS',
                message: 'Error updating API status'
            });
        }
});

// Get default API for product
apiConfigRouter.get('/product/:productId/default',
    authenticateToken,
    // authorize(['view_apis', 'manage_apis']),
    async (req, res) => {
        try {
            const config = await apiConfigDao.getDefaultApiConfig(req.params.productId);
            
            if (!config) {
                return res.status(404).send({
                    messageCode: 'DEFAULT_API_NOT_FOUND',
                    message: 'No default API found for this product'
                });
            }

            res.send(config);
        } catch (error) {
            log.error('Error getting default API:', error);
            res.status(500).send({
                messageCode: 'ERR_GET_DEFAULT_API',
                message: 'Error retrieving default API'
            });
        }
});

module.exports = apiConfigRouter;
