// permission-controller.js
const express = require('express');
const permissionRouter = express.Router();
const permissionDao = require('./permission-dao');
const Logger = require('../logger/logger');
const log = new Logger('Permission-Controller');
const { authenticateToken, authorize } = require('../middleware/auth-token-validator');
const Joi = require('joi');

// Validation schema for permission
const permissionSchema = Joi.object({
    name: Joi.string().min(3).max(100).required(),
    description: Joi.string().min(3).max(200)
});

// Create new permission (Admin only)
permissionRouter.post('/',
    authenticateToken,
    authorize(['manage_roles']),
    async (req, res) => {
        try {
            const { error } = permissionSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALDERR',
                    message: error.details[0].message
                });
            }

            const newPermission = await permissionDao.createPermission(req.body);
            res.status(201).send({
                messageCode: 'PERMISSION_CREATED',
                message: 'Permission created successfully',
                permission: newPermission
            });
        } catch (error) {
            if (error.code === '23505') { // Unique constraint violation
                return res.status(400).send({
                    messageCode: 'DUPLICATE_PERMISSION',
                    message: 'Permission with this name already exists'
                });
            }
            log.error('Error creating permission:', error);
            res.status(500).send({
                messageCode: 'ERR_PERMISSION_CREATE',
                message: 'Error creating permission'
            });
        }
});

// Update permission
permissionRouter.put('/:id',
    authenticateToken,
    authorize(['manage_roles']),
    async (req, res) => {
        try {
            const { error } = permissionSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALDERR',
                    message: error.details[0].message
                });
            }

            const updatedPermission = await permissionDao.updatePermission(req.params.id, req.body);
            if (!updatedPermission) {
                return res.status(404).send({
                    messageCode: 'PERMISSION_NOT_FOUND',
                    message: 'Permission not found'
                });
            }

            res.send({
                messageCode: 'PERMISSION_UPDATED',
                message: 'Permission updated successfully',
                permission: updatedPermission
            });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(400).send({
                    messageCode: 'DUPLICATE_PERMISSION',
                    message: 'Permission with this name already exists'
                });
            }
            log.error('Error updating permission:', error);
            res.status(500).send({
                messageCode: 'ERR_PERMISSION_UPDATE',
                message: 'Error updating permission'
            });
        }
});

// Delete permission
permissionRouter.delete('/:id',
    authenticateToken,
    authorize(['manage_roles']),
    async (req, res) => {
        try {
            await permissionDao.deletePermission(req.params.id);
            res.send({
                messageCode: 'PERMISSION_DELETED',
                message: 'Permission deleted successfully'
            });
        } catch (error) {
            if (error.code === '23503') { // Foreign key violation
                return res.status(400).send({
                    messageCode: 'PERMISSION_IN_USE',
                    message: 'Cannot delete permission as it is assigned to roles'
                });
            }
            log.error('Error deleting permission:', error);
            res.status(500).send({
                messageCode: 'ERR_PERMISSION_DELETE',
                message: 'Error deleting permission'
            });
        }
});

// Get permission by ID
permissionRouter.get('/:id',
    authenticateToken,
    authorize(['view_roles', 'manage_roles']),
    async (req, res) => {
        try {
            const permission = await permissionDao.getPermissionById(req.params.id);
            if (!permission) {
                return res.status(404).send({
                    messageCode: 'PERMISSION_NOT_FOUND',
                    message: 'Permission not found'
                });
            }
            res.send(permission);
        } catch (error) {
            log.error('Error getting permission:', error);
            res.status(500).send({
                messageCode: 'ERR_PERMISSION_GET',
                message: 'Error retrieving permission'
            });
        }
});

// Get all permissions
permissionRouter.get('/',
    authenticateToken,
    authorize(['view_roles', 'manage_roles']),
    async (req, res) => {
        try {
            const permissions = await permissionDao.getAllPermissions();
            res.send(permissions);
        } catch (error) {
            log.error('Error getting permissions:', error);
            res.status(500).send({
                messageCode: 'ERR_PERMISSIONS_GET',
                message: 'Error retrieving permissions'
            });
        }
});

module.exports = permissionRouter;