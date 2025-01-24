// permission-dao.js
const Logger = require('../logger/logger');
const log = new Logger('Permission-Dao');
const { db, permissions, userPermissions } = require('./db/schema');
const { eq, and } = require('drizzle-orm');

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
            const [permission] = await db
                .select({
                    id: permissions.id,
                    name: permissions.name,
                    description: permissions.description,
                    createdAt: permissions.createdAt,
                    updatedAt: permissions.updatedAt
                })
                .from(permissions)
                .where(eq(permissions.id, permissionId))
                .limit(1);

            return permission;
        } catch (error) {
            console.log('Error getting permission:', error);
            throw error;
        }
    }

    async getAllPermissions() {
        try {
            const allPermissions = await db
                .select({
                    id: permissions.id,
                    name: permissions.name,
                    description: permissions.description,
                    createdAt: permissions.createdAt,
                    updatedAt: permissions.updatedAt
                })
                .from(permissions)
                .orderBy(permissions.name);

            return allPermissions;
        } catch (error) {
            log.error('Error getting all permissions:', error);
            throw error;
        }
    }

    async getPermissionByName(name) {
        try {
            const [permission] = await db
                .select({
                    id: permissions.id,
                    name: permissions.name,
                    description: permissions.description,
                    createdAt: permissions.createdAt,
                    updatedAt: permissions.updatedAt
                })
                .from(permissions)
                .where(eq(permissions.name, name.toLowerCase()))
                .limit(1);

            return permission;
        } catch (error) {
            log.error('Error getting permission by name:', error);
            throw error;
        }
    }

    async assignPermissionsToUser(userId, permissionIds, createdBy) {
        try {
            const assignments = await db.transaction(async (tx) => {
                const results = [];
                
                for (const permissionId of permissionIds) {
                    const [assignment] = await tx.insert(userPermissions)
                        .values({
                            userId,
                            permissionId,
                            createdBy
                        })
                        .returning();
                    results.push(assignment);
                }
                
                return results;
            });
            
            return assignments;
        } catch (error) {
            console.log('Error assigning permissions to user:', error);
            log.error('Error assigning permissions to user:', error);
            throw error;
        }
    }

    async removePermissionFromUser(userId, permissionId) {
        try {
            const [removed] = await db.delete(userPermissions)
                .where(
                    and(
                        eq(userPermissions.userId, userId),
                        eq(userPermissions.permissionId, permissionId)
                    )
                )
                .returning();
            return removed;
        } catch (error) {
            log.error('Error removing permission from user:', error);
            throw error;
        }
    }

    async getUserDirectPermissions(userId) {
        try {
            const userPerms = await db
                .select({
                    id: permissions.id,
                    name: permissions.name,
                    description: permissions.description,
                    createdBy: userPermissions.createdBy
                })
                .from(userPermissions)
                .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
                .where(eq(userPermissions.userId, userId))
                .orderBy(permissions.name);
            
            return userPerms;
        } catch (error) {
            console.log('Error getting user direct permissions:', error);
            log.error('Error getting user direct permissions:', error);
            throw error;
        }
    }

    async getUsersWithPermission(permissionId) {
        try {
            const users = await db
                .select({
                    userId: userPermissions.userId,
                    assignedAt: userPermissions.createdAt,
                    assignedBy: userPermissions.createdBy
                })
                .from(userPermissions)
                .where(eq(userPermissions.permissionId, permissionId))
                .orderBy(userPermissions.createdAt);

            return users;
        } catch (error) {
            log.error('Error getting users with permission:', error);
            throw error;
        }
    }
}

module.exports = new PermissionDao();