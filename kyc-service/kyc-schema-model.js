// kyc-service/kyc-schema-model.js
const Joi = require('joi');

const aadharVerificationSchema = Joi.object({
    aadharNumber: Joi.string()
        .length(12)
        .pattern(/^[0-9]+$/)
        .required()
        .messages({
            'string.length': 'Aadhar number must be exactly 12 digits',
            'string.pattern.base': 'Aadhar number must contain only numbers'
        }),
    fullName: Joi.string()
        .min(3)
        .max(100)
        .required()
        .messages({
            'string.min': 'Full name must be at least 3 characters long',
            'string.max': 'Full name cannot exceed 100 characters'
        }),
    dateOfBirth: Joi.date()
        .iso()
        .max('now')
        .required()
        .messages({
            'date.max': 'Date of birth cannot be in the future'
        }),
    gender: Joi.string()
        .valid('MALE', 'FEMALE', 'OTHER')
        .required(),
    address: Joi.string()
        .min(10)
        .max(500)
        .required()
        .messages({
            'string.min': 'Address must be at least 10 characters long',
            'string.max': 'Address cannot exceed 500 characters'
        })
});

const panVerificationSchema = Joi.object({
    panNumber: Joi.string()
        .length(10)
        .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
        .required()
        .messages({
            'string.length': 'PAN number must be exactly 10 characters',
            'string.pattern.base': 'Invalid PAN number format. It should be in format ABCDE1234F'
        }),
    fullName: Joi.string()
        .min(3)
        .max(100)
        .required()
        .messages({
            'string.min': 'Full name must be at least 3 characters long',
            'string.max': 'Full name cannot exceed 100 characters'
        }),
    dateOfBirth: Joi.date()
        .iso()
        .max('now')
        .required()
        .messages({
            'date.max': 'Date of birth cannot be in the future'
        })
});

const documentUploadSchema = Joi.object({
    file: Joi.object({
        mimetype: Joi.string()
            .valid('image/jpeg', 'image/png', 'image/jpg')
            .required()
            .messages({
                'any.only': 'Only JPEG, JPG and PNG files are allowed'
            }),
        size: Joi.number()
            .max(5 * 1024 * 1024) // 5MB
            .required()
            .messages({
                'number.max': 'File size cannot exceed 5MB'
            })
    }).required()
});

module.exports = {
    aadharVerificationSchema,
    panVerificationSchema,
    documentUploadSchema
};