// scheme-service/scheme-schema-model.js
const Joi = require('joi');

const schemeSchema = Joi.object({
    name: Joi.string()
        .min(3)
        .max(100)
        .required()
        .messages({
            'string.min': 'Scheme name must be at least 3 characters long',
            'string.max': 'Scheme name cannot exceed 100 characters'
        }),
    status: Joi.string()
        .valid('ACTIVE', 'INACTIVE')
        .default('INACTIVE')
});

const schemeChargeSchema = Joi.object({
    charges: Joi.array().items(
        Joi.object({
            payoutRange: Joi.string()
                .required()
                .pattern(/^\d+-\d+$/)
                .messages({
                    'string.pattern.base': 'Payout range must be in format "min-max" (e.g., "100-500")'
                }),
            chargeType: Joi.string()
                .valid('FLAT', 'PERCENTAGE')
                .required(),
            chargeValue: Joi.number()
                .positive()
                .required(),
            partnerValue: Joi.number()
                .positive(),
            apiuserValue: Joi.number()
                .positive()
        })
    ).min(1).required()
});

module.exports = {
    schemeSchema,
    schemeChargeSchema
};
