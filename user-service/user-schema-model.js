// user-schema-model.js
const Joi = require('joi');
const Logger = require('../logger/logger');
const log = new Logger('User-Schema-Model');

const locationSchemaModel = Joi.object({
    latitude: Joi.number().min(-90).max(90).allow(null),
    longitude: Joi.number().min(-180).max(180).allow(null)
}).allow(null);

const loginUserInputSchemaModel = Joi.object({
    username: Joi.string().min(3).required()
        .messages({
            'string.min': 'Username must be at least 3 characters long',
            'any.required': 'Username is required'
        }),
    password: Joi.string().min(8).required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'any.required': 'Password is required'
        }),
    location: locationSchemaModel
        .messages({
            'object.base': 'Location must be an object with latitude and longitude',
            'number.min': 'Invalid coordinates',
            'number.max': 'Invalid coordinates'
        })
});
const updatePasswordInputSchemaModel = Joi.object({
    username: Joi.string().min(6).required(),
    password: Joi.string().min(8).required(),
    emailId: Joi.string().email().required(),
    dateOfBirth: Joi.date().iso().required()
});

const updateEmailInputSchemaModel = Joi.object({
    username: Joi.string().min(6).required(),
    emailId: Joi.string().email().required()
});

const updatePhoneNoInputSchemaModel = Joi.object({
    username: Joi.string().min(6).required(),
    phoneNo: Joi.string().length(10).pattern(/^[0-9]+$/).required()
});

const updateAddressInputSchemaModel = Joi.object({
    username: Joi.string().min(6).required(),
    address: Joi.object({
        firstline: Joi.string().min(1).required(),
        secondline: Joi.string().min(1).required(),
        city: Joi.string().min(3).required(),
        country: Joi.string().min(3).required(),
        pin: Joi.string().min(6).required()
    }).required()
});

const getUserByUsernameInputSchemaModel = Joi.object({
    username: Joi.string().min(6).required()
});

const getUserByPhoneNoInputSchemaModel = Joi.object({
    phoneNo: Joi.string().length(10).pattern(/^[0-9]+$/).required()
});


const addressInputSchemaModel = Joi.object({
    firstline: Joi.string().min(1).required(),
    secondline: Joi.string().min(1).required(),
    city: Joi.string().min(3).required(),
    country: Joi.string().min(3).required(),
    pin: Joi.string().min(6).required()
});

const businessInformationInputSchemaModel = Joi.object({
    shopName: Joi.string().min(3).max(100).required()
        .messages({
            'string.min': 'Shop name must be at least 3 characters long',
            'string.max': 'Shop name cannot exceed 100 characters',
            'any.required': 'Shop name is required'
        }),
    pancardNumber: Joi.string().length(10).pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required()
        .messages({
            'string.length': 'PAN card number must be exactly 10 characters',
            'string.pattern.base': 'Invalid PAN card number format',
            'any.required': 'PAN card number is required'
        }),
    adhaarNumber: Joi.string().length(12).pattern(/^[0-9]+$/).required()
        .messages({
            'string.length': 'Adhaar number must be exactly 12 digits',
            'string.pattern.base': 'Adhaar number must contain only digits',
            'any.required': 'Adhaar number is required'
        }),
    businessEmail: Joi.string().email()
        .messages({
            'string.email': 'Please provide a valid business email address'
        }),
    businessDomain: Joi.string().domain()
        .messages({
            'string.domain': 'Please provide a valid domain name'
        }),
    rmCode: Joi.string().max(50)
        .messages({
            'string.max': 'RM code cannot exceed 50 characters'
        })
});

const registerInputUserSchemaModel = Joi.object({
    firstname: Joi.string().min(1).required(),
    lastname: Joi.string().min(1).required(),
    emailId: Joi.string().email().required(),
    dateOfBirth: Joi.date().iso().required(),
    username: Joi.string().min(6).required(),
    phoneNo: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
    roleId: Joi.number().default(3),
    address: addressInputSchemaModel.required(),
    businessInformation: businessInformationInputSchemaModel.required()
});

const forgotPasswordInputSchemaModel = Joi.object({
    emailId: Joi.string().email().required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        })
});

const resetPasswordInputSchemaModel = Joi.object({
    token: Joi.string().required()
        .messages({
            'any.required': 'Reset token is required'
        }),
    password: Joi.string().min(8).required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'any.required': 'New password is required'
        })
});

const changePasswordInputSchemaModel = Joi.object({
    currentPassword: Joi.string().required()
        .messages({
            'any.required': 'Current password is required'
        }),
    newPassword: Joi.string().min(8).required()
        .messages({
            'string.min': 'New password must be at least 8 characters long',
            'any.required': 'New password is required'
        })
});

module.exports = {
    registerInputUserSchemaModel,
    loginUserInputSchemaModel,
    updatePasswordInputSchemaModel,
    updateEmailInputSchemaModel,
    updatePhoneNoInputSchemaModel,
    updateAddressInputSchemaModel,
    getUserByUsernameInputSchemaModel,
    getUserByPhoneNoInputSchemaModel,
    resetPasswordInputSchemaModel,
    changePasswordInputSchemaModel,
    forgotPasswordInputSchemaModel
};