// role-dao.js
const Logger = require('../logger/logger');
const log = new Logger('Role-Dao');
const { db, roles, permissions, rolePermissions } = require('./db/schema');
const { eq, and } = require('drizzle-orm');

class RoleDao {
    async createRole(roleData) {
        try {
            const [newRole] = await db.transaction(async (tx) => {
                // Create role
                const [role] = await tx.insert(roles)
                    .values({
                        name: roleData.name.toUpperCase(),
                        description: roleData.description
                    })
                    .returning();

                // If permissions are provided, assign them
                if (roleData.permissions && roleData.permissions.length > 0) {
                    const permissionValues = roleData.permissions.map(permId => ({
                        roleId: role.id,
                        permissionId: permId
                    }));

                    await tx.insert(rolePermissions)
                        .values(permissionValues);
                }

                return [role];
            });

            return newRole;
        } catch (error) {
            log.error('Error creating role:', error);
            throw error;
        }
    }

    async updateRole(roleId, roleData) {
        try {
            const result = await db.transaction(async (tx) => {
                // Update role
                const [updatedRole] = await tx.update(roles)
                    .set({
                        name: roleData.name.toUpperCase(),
                        description: roleData.description,
                        updatedAt: new Date()
                    })
                    .where(eq(roles.id, roleId))
                    .returning();

                // If permissions are provided, update them
                if (roleData.permissions) {
                    // Remove existing permissions
                    await tx.delete(rolePermissions)
                        .where(eq(rolePermissions.roleId, roleId));

                    // Add new permissions
                    if (roleData.permissions.length > 0) {
                        const permissionValues = roleData.permissions.map(permId => ({
                            roleId,
                            permissionId: permId
                        }));

                        await tx.insert(rolePermissions)
                            .values(permissionValues);
                    }
                }

                return updatedRole;
            });

            return result;
        } catch (error) {
            log.error('Error updating role:', error);
            throw error;
        }
    }

    async deleteRole(roleId) {
        try {
            const deletedRole = await db.transaction(async (tx) => {
                // Delete role permissions first
                await tx.delete(rolePermissions)
                    .where(eq(rolePermissions.roleId, roleId));

                // Delete role
                const [role] = await tx.delete(roles)
                    .where(eq(roles.id, roleId))
                    .returning();

                return role;
            });

            return deletedRole;
        } catch (error) {
            log.error('Error deleting role:', error);
            throw error;
        }
    }

    async getRoleById(roleId) {
        try {
            const role = await db.query.roles.findFirst({
                where: eq(roles.id, roleId),
                with: {
                    permissions: {
                        through: {
                            columns: []
                        }
                    }
                }
            });
            return role;
        } catch (error) {
            log.error('Error getting role:', error);
            throw error;
        }
    }

    async getAllRoles() {
        try {
            const allRoles = await db.query.roles.findMany({
                with: {
                    permissions: {
                        through: {
                            columns: []
                        }
                    }
                }
            });
            return allRoles;
        } catch (error) {
            log.error('Error getting all roles:', error);
            throw error;
        }
    }

    async addPermissionToRole(roleId, permissionId) {
        try {
            const [newRolePermission] = await db.insert(rolePermissions)
                .values({ roleId, permissionId })
                .returning();
            return newRolePermission;
        } catch (error) {
            log.error('Error adding permission to role:', error);
            throw error;
        }
    }

    async removePermissionFromRole(roleId, permissionId) {
        try {
            const [removedPermission] = await db.delete(rolePermissions)
                .where(
                    and(
                        eq(rolePermissions.roleId, roleId),
                        eq(rolePermissions.permissionId, permissionId)
                    )
                )
                .returning();
            return removedPermission;
        } catch (error) {
            log.error('Error removing permission from role:', error);
            throw error;
        }
    }

    async getRolePermissions(roleId) {
        try {
            const permissions = await db.query.rolePermissions.findMany({
                where: eq(rolePermissions.roleId, roleId),
                with: {
                    permission: true
                }
            });
            return permissions.map(rp => rp.permission);
        } catch (error) {
            log.error('Error getting role permissions:', error);
            throw error;
        }
    }
}

module.exports = new RoleDao();