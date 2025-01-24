// role-controller.js
const express = require('express');
const roleRouter = express.Router();
const roleDao = require('./role-dao');
const Logger = require('../logger/logger');
const log = new Logger('Role-Controller');
const { authenticateToken, authorize } = require('../middleware/auth-token-validator');
const Joi = require('joi');

const roleSchema = Joi.object({
    name: Joi.string().min(3).max(50).required(),
    description: Joi.string().min(3).max(200),
    permissions: Joi.array().items(Joi.number()).min(1)
});

const roleIdSchema = Joi.object({
    roleId: Joi.number().required()
});

roleRouter.post('/', 
    authenticateToken, 
    authorize(['manage_roles']), 
    async (req, res) => {
        try {
            const { error } = roleSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALDERR',
                    message: error.details[0].message
                });
            }

            const newRole = await roleDao.createRole(req.body);
            res.status(201).send({
                messageCode: 'ROLE_CREATED',
                message: 'Role created successfully',
                role: newRole
            });
        } catch (error) {
            log.error('Error creating role:', error);
            res.status(500).send({
                messageCode: 'ERR_ROLE_CREATE',
                message: 'Error creating role'
            });
        }
});

roleRouter.put('/:roleId', 
    authenticateToken, 
    authorize(['manage_roles']), 
    async (req, res) => {
        try {
            const { error: roleIdError } = roleIdSchema.validate({ roleId: parseInt(req.params.roleId) });
            if (roleIdError) {
                return res.status(400).send({
                    messageCode: 'VALDERR',
                    message: roleIdError.details[0].message
                });
            }

            const { error: roleDataError } = roleSchema.validate(req.body);
            if (roleDataError) {
                return res.status(400).send({
                    messageCode: 'VALDERR',
                    message: roleDataError.details[0].message
                });
            }

            const updatedRole = await roleDao.updateRole(req.params.roleId, req.body);
            if (!updatedRole) {
                return res.status(404).send({
                    messageCode: 'ROLE_NOT_FOUND',
                    message: 'Role not found'
                });
            }

            res.send({
                messageCode: 'ROLE_UPDATED',
                message: 'Role updated successfully',
                role: updatedRole
            });
        } catch (error) {
            log.error('Error updating role:', error);
            res.status(500).send({
                messageCode: 'ERR_ROLE_UPDATE',
                message: 'Error updating role'
            });
        }
});

roleRouter.delete('/:roleId', 
    authenticateToken, 
    authorize(['manage_roles']), 
    async (req, res) => {
        try {
            const { error } = roleIdSchema.validate({ roleId: parseInt(req.params.roleId) });
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALDERR',
                    message: error.details[0].message
                });
            }

            await roleDao.deleteRole(req.params.roleId);
            res.send({
                messageCode: 'ROLE_DELETED',
                message: 'Role deleted successfully'
            });
        } catch (error) {
            if (error.code === '23503') { // Foreign key violation
                return res.status(400).send({
                    messageCode: 'ROLE_IN_USE',
                    message: 'Cannot delete role as it is assigned to users'
                });
            }
            log.error('Error deleting role:', error);
            res.status(500).send({
                messageCode: 'ERR_ROLE_DELETE',
                message: 'Error deleting role'
            });
        }
});

roleRouter.get('/:roleId', 
    authenticateToken, 
    authorize(['view_roles', 'manage_roles']), 
    async (req, res) => {
        try {
            const { error } = roleIdSchema.validate({ roleId: parseInt(req.params.roleId) });
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALDERR',
                    message: error.details[0].message
                });
            }

            const role = await roleDao.getRoleById(req.params.roleId);
            if (!role) {
                return res.status(404).send({
                    messageCode: 'ROLE_NOT_FOUND',
                    message: 'Role not found'
                });
            }
            res.send(role);
        } catch (error) {
            log.error('Error getting role:', error);
            res.status(500).send({
                messageCode: 'ERR_ROLE_GET',
                message: 'Error retrieving role'
            });
        }
});

roleRouter.get('/', 
    authenticateToken, 
    authorize(['view_roles', 'manage_roles']), 
    async (req, res) => {
        try {
            const roles = await roleDao.getAllRoles();
            res.send(roles);
        } catch (error) {
            log.error('Error getting roles:', error);
            res.status(500).send({
                messageCode: 'ERR_ROLES_GET',
                message: 'Error retrieving roles'
            });
        }
});

roleRouter.post('/:roleId/permissions', 
    authenticateToken, 
    authorize(['manage_roles']), 
    async (req, res) => {
        try {
            const { roleId } = req.params;
            const { permissionId } = req.body;

            const rolePermission = await roleDao.addPermissionToRole(roleId, permissionId);
            res.status(201).send({
                messageCode: 'PERMISSION_ADDED',
                message: 'Permission added to role successfully',
                rolePermission
            });
        } catch (error) {
            log.error('Error adding permission to role:', error);
            res.status(500).send({
                messageCode: 'ERR_ADD_PERMISSION',
                message: 'Error adding permission to role'
            });
        }
});

roleRouter.delete('/:roleId/permissions/:permissionId', 
    authenticateToken, 
    authorize(['manage_roles']), 
    async (req, res) => {
        try {
            const { roleId, permissionId } = req.params;

            await roleDao.removePermissionFromRole(roleId, permissionId);
            res.send({
                messageCode: 'PERMISSION_REMOVED',
                message: 'Permission removed from role successfully'
            });
        } catch (error) {
            log.error('Error removing permission from role:', error);
            res.status(500).send({
                messageCode: 'ERR_REMOVE_PERMISSION',
                message: 'Error removing permission from role'
            });
        }
});

roleRouter.get('/:roleId/permissions', 
    authenticateToken, 
    authorize(['view_roles', 'manage_roles']), 
    async (req, res) => {
        try {
            const { roleId } = req.params;
            const permissions = await roleDao.getRolePermissions(roleId);
            res.send(permissions);
        } catch (error) {
            log.error('Error getting role permissions:', error);
            res.status(500).send({
                messageCode: 'ERR_GET_PERMISSIONS',
                message: 'Error retrieving role permissions'
            });
        }
});

module.exports = roleRouter;