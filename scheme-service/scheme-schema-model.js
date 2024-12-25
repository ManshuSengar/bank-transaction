const Joi = require('joi');

const apiConfigSchema = Joi.object({
    productId: Joi.number().required(),
    name: Joi.string().min(3).max(100).required(),
    baseUrl: Joi.string().uri().required(),
    username: Joi.string(),
    password: Joi.string(),
    apiKey: Joi.string(),
    secretKey: Joi.string(),
    ipWhitelist: Joi.string(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE'),
    priority: Joi.number().integer().min(0),
    isDefault: Joi.boolean().default(false)
});


const chargeSchema = Joi.object({
    apiConfigId: Joi.number().when('$productId', {
        is: Joi.valid(1, 2),
        then: Joi.required(),
        otherwise: Joi.forbidden()
    }),
    minAmount: Joi.number().positive().when('$productId', {
        is: 2,
        then: Joi.required(),
        otherwise: Joi.optional() // Changed from forbidden to optional
    }),
    maxAmount: Joi.number().positive().when('$productId', {
        is: 2,
        then: Joi.required(),
        otherwise: Joi.optional() // Changed from forbidden to optional
    }),
    chargeType: Joi.string().valid('FLAT', 'PERCENTAGE').required(),
    chargeValue: Joi.number().positive().required(),
    gst: Joi.number().min(0).max(100).optional(),
    tds: Joi.number().min(0).max(100).optional()
});

const schemeSchema = Joi.object({
    name: Joi.string().min(3).max(100).required(),
    productId: Joi.number().required(),
    description: Joi.string().optional().allow('', null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE'),
    minTransactionLimit: Joi.number().positive().optional().allow(null),
    maxTransactionLimit: Joi.number().positive().greater(Joi.ref('minTransactionLimit')).optional().allow(null),
    dailyLimit: Joi.number().positive().optional().allow(null),
    monthlyLimit: Joi.number().positive().optional().allow(null),
    charges: Joi.array().items(chargeSchema).min(1).required()
});



module.exports = {
    apiConfigSchema,
    schemeSchema
};