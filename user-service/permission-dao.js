// permission-dao.js
const Logger = require('../logger/logger');
const log = new Logger('Permission-Dao');
const { db, permissions } = require('./db/schema');
const { eq } = require('drizzle-orm');

class PermissionDao {
    async createPermission(permissionData) {
        try {
            const [newPermission] = await db.insert(permissions)
                .values({
                    name: permissionData.name.toLowerCase(),
                    description: permissionData.description
                })
                .returning();
            return newPermission;
        } catch (error) {
            log.error('Error creating permission:', error);
            throw error;
        }
    }

    async updatePermission(permissionId, permissionData) {
        try {
            const [updatedPermission] = await db.update(permissions)
                .set({
                    name: permissionData.name.toLowerCase(),
                    description: permissionData.description,
                    updatedAt: new Date()
                })
                .where(eq(permissions.id, permissionId))
                .returning();
            return updatedPermission;
        } catch (error) {
            log.error('Error updating permission:', error);
            throw error;
        }
    }

    async deletePermission(permissionId) {
        try {
            const [deletedPermission] = await db.delete(permissions)
                .where(eq(permissions.id, permissionId))
                .returning();
            return deletedPermission;
        } catch (error) {
            log.error('Error deleting permission:', error);
            throw error;
        }
    }

    async getPermissionById(permissionId) {
        try {
            const permission = await db.query.permissions.findFirst({
                where: eq(permissions.id, permissionId)
            });
            return permission;
        } catch (error) {
            log.error('Error getting permission:', error);
            throw error;
        }
    }

    async getAllPermissions() {
        try {
            const allPermissions = await db.query.permissions.findMany();
            return allPermissions;
        } catch (error) {
            log.error('Error getting all permissions:', error);
            throw error;
        }
    }

    async getPermissionByName(name) {
        try {
            const permission = await db.query.permissions.findFirst({
                where: eq(permissions.name, name.toLowerCase())
            });
            return permission;
        } catch (error) {
            log.error('Error getting permission by name:', error);
            throw error;
        }
    }
}

module.exports = new PermissionDao();