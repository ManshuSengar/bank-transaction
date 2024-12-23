const express = require('express');
const schemeRouter = express.Router();
const schemeDao = require('./scheme-dao');
const { schemeSchema } = require('./scheme-schema-model');
const Logger = require('../logger/logger');
const log = new Logger('Scheme-Controller');
const { authenticateToken, authorize } = require('../middleware/auth-token-validator');

// Create new scheme
schemeRouter.post('/',
    authenticateToken,
    // authorize(['manage_schemes']),
    async (req, res) => {
        try {
            // const { error } = schemeSchema.validate(req.body);
            // if (error) {
            //     return res.status(400).send({
            //         messageCode: 'VALIDATION_ERROR',
            //         message: error.details[0].message
            //     });
            // }

            const scheme = await schemeDao.createScheme({
                ...req.body,
                createdBy: req.user.userId
            });

            res.status(201).send({
                messageCode: 'SCHEME_CREATED',
                message: 'Scheme created successfully',
                scheme
            });
        } catch (error) {
            console.log('Error creating scheme:', error);
            log.error('Error creating scheme:', error);
            res.status(500).send({
                messageCode: 'ERR_CREATE_SCHEME',
                message: 'Error creating scheme'
            });
        }
});

// Update existing scheme
schemeRouter.put('/:id',
    authenticateToken,
    // authorize(['manage_schemes']),
    async (req, res) => {
        try {
            const { error } = schemeSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALIDATION_ERROR',
                    message: error.details[0].message
                });
            }

            const scheme = await schemeDao.updateScheme(req.params.id, req.body);
            
            if (!scheme) {
                return res.status(404).send({
                    messageCode: 'SCHEME_NOT_FOUND',
                    message: 'Scheme not found'
                });
            }

            res.send({
                messageCode: 'SCHEME_UPDATED',
                message: 'Scheme updated successfully',
                scheme
            });
        } catch (error) {
            log.error('Error updating scheme:', error);
            res.status(500).send({
                messageCode: 'ERR_UPDATE_SCHEME',
                message: 'Error updating scheme'
            });
        }
});

// Calculate charges
schemeRouter.post('/calculate-charges',
    authenticateToken,
    async (req, res) => {
        try {
            const { amount, schemeId, productId } = req.body;

            if (!amount || !schemeId || !productId) {
                return res.status(400).send({
                    messageCode: 'MISSING_PARAMETERS',
                    message: 'Amount, schemeId, and productId are required'
                });
            }

            const result = await schemeDao.calculateCharges(
                parseFloat(amount),
                parseInt(schemeId),
                parseInt(productId)
            );

            res.send({
                messageCode: 'CHARGES_CALCULATED',
                message: 'Charges calculated successfully',
                ...result
            });
        } catch (error) {
            log.error('Error calculating charges:', error);
            res.status(500).send({
                messageCode: 'ERR_CALCULATE_CHARGES',
                message: error.message || 'Error calculating charges'
            });
        }
});

// Get scheme by id
schemeRouter.get('/:id',
    authenticateToken,
    // authorize(['view_schemes', 'manage_schemes']),
    async (req, res) => {
        try {
            const scheme = await schemeDao.getSchemeById(req.params.id);
            
            if (!scheme) {
                return res.status(404).send({
                    messageCode: 'SCHEME_NOT_FOUND',
                    message: 'Scheme not found'
                });
            }

            res.send(scheme);
        } catch (error) {
            log.error('Error getting scheme:', error);
            res.status(500).send({
                messageCode: 'ERR_GET_SCHEME',
                message: 'Error retrieving scheme'
            });
        }
});

// Get all schemes with filters
schemeRouter.get('/',
    authenticateToken,
    // authorize(['view_schemes', 'manage_schemes']),
    async (req, res) => {
        try {
            const { page, limit, productId, status } = req.query;
            const schemes = await schemeDao.getSchemes({
                page: parseInt(page),
                limit: parseInt(limit),
                productId: productId ? parseInt(productId) : null,
                status
            });

            res.send(schemes);
        } catch (error) {
            log.error('Error getting schemes:', error);
            res.status(500).send({
                messageCode: 'ERR_GET_SCHEMES',
                message: 'Error retrieving schemes'
            });
        }
});

// Assign scheme to user
schemeRouter.post('/assign',
    authenticateToken,
    // authorize(['manage_schemes']),
    async (req, res) => {
        try {
            const { userId, schemeId } = req.body;

            if (!userId || !schemeId) {
                return res.status(400).send({
                    messageCode: 'MISSING_PARAMETERS',
                    message: 'userId and schemeId are required'
                });
            }

            const assignment = await schemeDao.assignSchemeToUser(
                parseInt(userId),
                parseInt(schemeId),
                req.user.userId
            );

            res.status(201).send({
                messageCode: 'SCHEME_ASSIGNED',
                message: 'Scheme assigned successfully',
                assignment
            });
        } catch (error) {
            console.log('Error assigning scheme:', error);
            log.error('Error assigning scheme:', error);
            res.status(500).send({
                messageCode: 'ERR_ASSIGN_SCHEME',
                message: 'Error assigning scheme'
            });
        }
});

// Get user's schemes
schemeRouter.get('/user/:userId/schemes',
    authenticateToken,
    async (req, res) => {
        try {
            const { productId } = req.query;
            const schemes = await schemeDao.getUserSchemes(
                parseInt(req.params.userId),
                productId ? parseInt(productId) : null
            );

            res.send({
                messageCode: 'USER_SCHEMES_FETCHED',
                message: 'User schemes retrieved successfully',
                schemes
            });
        } catch (error) {
            log.error('Error getting user schemes:', error);
            res.status(500).send({
                messageCode: 'ERR_GET_USER_SCHEMES',
                message: 'Error retrieving user schemes'
            });
        }
});

schemeRouter.get('/users-with-schemes',
    authenticateToken,
    // authorize(['view_schemes', 'manage_schemes']),
    async (req, res) => {
        try {
            const { page = 1, limit = 10, status, productId } = req.query;
            const users = await schemeDao.getUsersWithSchemes({
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                productId: productId ? parseInt(productId) : null
            });

            res.send({
                messageCode: 'USERS_SCHEMES_FETCHED',
                message: 'Users with schemes retrieved successfully',
                ...users
            });
        } catch (error) {
            log.error('Error getting users with schemes:', error);
            res.status(500).send({
                messageCode: 'ERR_GET_USERS_SCHEMES',
                message: 'Error retrieving users with schemes'
            });
        }
});


module.exports = schemeRouter;