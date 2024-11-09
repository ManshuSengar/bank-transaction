const express = require('express');
const schemeRouter = express.Router();
const schemeDao = require('./scheme-dao');
const { schemeSchema, schemeChargeSchema } = require('./scheme-schema-model');
const Logger = require('../logger/logger');
const log = new Logger('Scheme-Controller');
const { authenticateToken, authorize } = require('../middleware/auth-token-validator');

schemeRouter.post('/',
    authenticateToken,
    authorize(['manage_schemes']),
    async (req, res) => {
        try {
            const { error } = schemeSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALDERR',
                    message: error.details[0].message
                });
            }

            // First check if scheme exists
            const existingScheme = await schemeDao.checkSchemeExists(req.body.name);
            if (existingScheme) {
                return res.status(409).send({
                    messageCode: 'SCHEME_EXISTS',
                    message: 'A scheme with this name already exists'
                });
            }

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
            log.error('Error creating scheme:', error);
            
            // Handle specific error cases
            if (error.code === 'SCHEME_EXISTS') {
                return res.status(error.statusCode).send({
                    messageCode: 'SCHEME_EXISTS',
                    message: 'A scheme with this name already exists'
                });
            }

            res.status(500).send({
                messageCode: 'ERR_SCHEME_CREATE',
                message: 'Error creating scheme'
            });
        }
});

schemeRouter.post('/:schemeId/charges',
    authenticateToken,
    authorize(['manage_schemes']),
    async (req, res) => {
        try {
            const { error } = schemeChargeSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALDERR',
                    message: error.details[0].message
                });
            }

            const charges = await schemeDao.addSchemeCharges(
                req.params.schemeId,
                req.body
            );

            res.status(201).send({
                messageCode: 'CHARGES_ADDED',
                message: 'Charges added successfully',
                charges
            });
        } catch (error) {
            log.error('Error adding scheme charges:', error);
            res.status(500).send({
                messageCode: 'ERR_CHARGES_ADD',
                message: 'Error adding charges'
            });
        }
});

schemeRouter.post('/assign',
    authenticateToken,
    authorize(['manage_schemes']),
    async (req, res) => {
        try {
            const { userId, schemeId } = req.body;
            await schemeDao.assignSchemeToUser(userId, schemeId);

            res.send({
                messageCode: 'SCHEME_ASSIGNED',
                message: 'Scheme assigned successfully'
            });
        } catch (error) {
            log.error('Error assigning scheme:', error);
            res.status(500).send({
                messageCode: 'ERR_SCHEME_ASSIGN',
                message: 'Error assigning scheme'
            });
        }
});

schemeRouter.get('/:schemeId',
    authenticateToken,
    authorize(['view_schemes', 'manage_schemes']),
    async (req, res) => {
        try {
            const scheme = await schemeDao.getSchemeById(req.params.schemeId);
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
                messageCode: 'ERR_SCHEME_GET',
                message: 'Error retrieving scheme'
            });
        }
});

schemeRouter.put('/:schemeId/status',
    authenticateToken,
    authorize(['manage_schemes']),
    async (req, res) => {
        try {
            const { status } = req.body;
            if (!['ACTIVE', 'INACTIVE'].includes(status)) {
                return res.status(400).send({
                    messageCode: 'INVALID_STATUS',
                    message: 'Invalid scheme status'
                });
            }

            const scheme = await schemeDao.updateSchemeStatus(
                req.params.schemeId,
                status
            );

            res.send({
                messageCode: 'STATUS_UPDATED',
                message: 'Scheme status updated successfully',
                scheme
            });
        } catch (error) {
            log.error('Error updating scheme status:', error);
            res.status(500).send({
                messageCode: 'ERR_STATUS_UPDATE',
                message: 'Error updating status'
            });
        }
});

module.exports = schemeRouter;


