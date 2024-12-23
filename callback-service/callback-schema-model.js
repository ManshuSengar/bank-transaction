const Joi = require('joi');

const callbackConfigSchema = Joi.object({
    name: Joi.string().min(3).max(100).required(),
    callbackUrl: Joi.string().uri().required(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE')
});

const callbackRequestSchema = Joi.object({
    configId: Joi.number().required(),
    originalRequestData: Joi.object().required(),
    decryptedData: Joi.object().required(),
    encryptedResponseData: Joi.object().optional(),
    status: Joi.string().valid('SUCCESS', 'FAILED', 'PENDING').required(),
    errorMessage: Joi.string().optional(),
    ipAddress: Joi.string().ip().optional(),
    userAgent: Joi.string().optional()
});

module.exports = {
    callbackConfigSchema,
    callbackRequestSchema
};