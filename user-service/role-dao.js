// role-dao.js
const Logger = require('../logger/logger');
const log = new Logger('Role-Dao');
const { db, roles, permissions, rolePermissions } = require('./db/schema');
const { eq, and } = require('drizzle-orm');

class RoleDao {
    async createRole(roleData) {
        try {
            const [newRole] = await db.transaction(async (tx) => {
                const [role] = await tx.insert(roles)
                    .values({
                        name: roleData.name.toUpperCase(),
                        description: roleData.description
                    })
                    .returning();
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
                const [updatedRole] = await tx.update(roles)
                    .set({
                        name: roleData.name.toUpperCase(),
                        description: roleData.description,
                        updatedAt: new Date()
                    })
                    .where(eq(roles.id, roleId))
                    .returning();
                if (roleData.permissions) {
                    await tx.delete(rolePermissions)
                        .where(eq(rolePermissions.roleId, roleId));

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
                await tx.delete(rolePermissions)
                    .where(eq(rolePermissions.roleId, roleId));

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
            const [role] = await db
                .select({
                    id: roles.id,
                    name: roles.name,
                    description: roles.description,
                    createdAt: roles.createdAt,
                    updatedAt: roles.updatedAt,
                    permissions: db
                        .select({
                            id: permissions.id,
                            name: permissions.name,
                            description: permissions.description
                        })
                        .from(permissions)
                        .innerJoin(rolePermissions, eq(rolePermissions.permissionId, permissions.id))
                        .where(eq(rolePermissions.roleId, roleId))
                })
                .from(roles)
                .where(eq(roles.id, roleId))
                .limit(1);

            return role;
        } catch (error) {
            log.error('Error getting role:', error);
            throw error;
        }
    }

    async getAllRoles() {
        try {
            const roles = await db
                .select({
                    id: roles.id,
                    name: roles.name,
                    description: roles.description,
                    createdAt: roles.createdAt,
                    updatedAt: roles.updatedAt,
                    permissions: db
                        .select({
                            id: permissions.id,
                            name: permissions.name,
                            description: permissions.description
                        })
                        .from(permissions)
                        .innerJoin(rolePermissions, eq(rolePermissions.permissionId, permissions.id))
                        .where(eq(rolePermissions.roleId, roles.id))
                })
                .from(roles);

            return roles;
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
            const rolePermissionsList = await db
                .select({
                    id: permissions.id,
                    name: permissions.name,
                    description: permissions.description,
                    createdAt: permissions.createdAt,
                    updatedAt: permissions.updatedAt
                })
                .from(rolePermissions)
                .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
                .where(eq(rolePermissions.roleId, roleId));

            return rolePermissionsList;
        } catch (error) {
            log.error('Error getting role permissions:', error);
            throw error;
        }
    }
}

module.exports = new RoleDao();