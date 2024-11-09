const jwt = require('jsonwebtoken');
const config = require('config');
const Logger = require('../logger/logger');
const log = new Logger('Auth-Middleware');
const { db, rolePermissions, permissions, userPermissions } = require('../user-service/db/schema');
const { eq, and, or } = require('drizzle-orm');

const secretKey = getJwtSecretKey();

async function authenticateToken(req, res, next) {
    const token = req.header('x-auth-token');
    if (!token) {
        return res.status(401).send({
            message: 'Access denied. Authentication token not found.',
            messageCode: 'TKNERR'
        });
    }

    try {
        const decoded = jwt.verify(token, secretKey);
        req.user = decoded;
        const userPerms = await getUserPermissions(decoded.userId, decoded.roleId);
        req.user.permissions = userPerms;
        next();
    } catch (err) {
        log.error('Invalid token:', err);
        return res.status(401).send({
            message: 'Access denied. Invalid authentication token.',
            messageCode: 'INVTKN'
        });
    }
}

async function getUserPermissions(userId, roleId) {
    try {
        const rolePerms = await db
            .select({
                permissionName: permissions.name
            })
            .from(rolePermissions)
            .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
            .where(eq(rolePermissions.roleId, roleId));

        const directPerms = await db
            .select({
                permissionName: permissions.name
            })
            .from(userPermissions)
            .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
            .where(eq(userPermissions.userId, userId));

        const allPermissions = [...rolePerms, ...directPerms];
        const uniquePermissions = [...new Set(allPermissions.map(p => p.permissionName))];
        
        return uniquePermissions;
    } catch (error) {
        log.error('Error getting user permissions:', error);
        return [];
    }
}

function authorize(requiredPermissions = []) {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).send({
                    message: 'Access denied. No authenticated user.',
                    messageCode: 'NOAUTH'
                });
            }
            const userPermissions = req.user.permissions || [];
            const hasRequiredPermissions = requiredPermissions.every(
                permission => userPermissions.includes(permission)
            );
            if (!hasRequiredPermissions) {
                log.warn(`Access denied for user ${req.user.username}. Required permissions: ${requiredPermissions.join(', ')}`);
                return res.status(403).send({
                    message: 'Access denied. Insufficient permissions.',
                    messageCode: 'INSUFPRM'
                });
            }
            next();
        } catch (error) {
            log.error('Error in authorization:', error);
            return res.status(500).send({
                message: 'Internal server error during authorization.',
                messageCode: 'AUTHERR'
            });
        }
    };
}

function getJwtSecretKey() {
    try {
        return config.get('jwt.secretkey');
    } catch (err) {
        console.error('\x1b[31mUnable to start application without JWT secret key. Please set "bankingapp-secretkey" in environment variable and try again.\x1b[0m');
        process.exit(0);
    }
}

module.exports = {
    authenticateToken,
    authorize
};