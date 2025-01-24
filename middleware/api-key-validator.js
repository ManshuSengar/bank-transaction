// middleware/api-key-validator.js
const Logger = require('../logger/logger');
const log = new Logger('API-Key-Validator');
const { db, apiKeys, users } = require('../api-service/db/schema');
const { eq } = require('drizzle-orm');

async function validateApiKey(req, res, next) {
    try {
        const apiKey = req.header('x-api-key');
        if (!apiKey) {
            return res.status(401).send({
                statusCode: '0',
                status: 'FAILED',
                message: 'API key is required',
                errorCode: 'API_KEY_MISSING'
            });
        }

        // Get API key details with associated user
        const [keyDetails] = await db
            .select({
                apiKey: apiKeys,
                user: users
            })
            .from(apiKeys)
            .innerJoin(users, eq(apiKeys.userId, users.id))
            .where(eq(apiKeys.key, apiKey))
            .limit(1);

        if (!keyDetails) {
            return res.status(401).send({
                statusCode: '0',
                status: 'FAILED',
                message: 'Invalid API key',
                errorCode: 'INVALID_API_KEY'
            });
        }

        // Check if API key is active
        if (keyDetails.apiKey.status !== 'ACTIVE') {
            return res.status(401).send({
                statusCode: '0',
                status: 'FAILED',
                message: 'API key is inactive',
                errorCode: 'INACTIVE_API_KEY'
            });
        }

        // Check if API key has expired
        if (keyDetails.apiKey.expiresAt && new Date() > new Date(keyDetails.apiKey.expiresAt)) {
            return res.status(401).send({
                statusCode: '0',
                status: 'FAILED',
                message: 'API key has expired',
                errorCode: 'EXPIRED_API_KEY'
            });
        }

        // Check IP whitelist if configured
        if (keyDetails.apiKey.ipWhitelist) {
            const allowedIps = keyDetails.apiKey.ipWhitelist.split(',').map(ip => ip.trim());
            const clientIp = req.ip;
            if (!allowedIps.includes(clientIp)) {
                log.warn(`Unauthorized IP access attempt: ${clientIp} using API key: ${apiKey}`);
                return res.status(401).send({
                    statusCode: '0',
                    status: 'FAILED',
                    message: 'Unauthorized IP address',
                    errorCode: 'UNAUTHORIZED_IP'
                });
            }
        }

        // Update last used timestamp
        await db.update(apiKeys)
            .set({
                lastUsedAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(apiKeys.key, apiKey));

        // Add user and API key details to request object
        req.user = {
            id: keyDetails.user.id,
            username: keyDetails.user.username,
            roleId: keyDetails.user.roleId,
            apiKeyId: keyDetails.apiKey.id
        };

        next();
    } catch (error) {
        log.error('Error validating API key:', error);
        return res.status(500).send({
            statusCode: '0',
            status: 'FAILED',
            message: 'Error validating API key',
            errorCode: 'VALIDATION_ERROR'
        });
    }
}

module.exports = {
    validateApiKey
};