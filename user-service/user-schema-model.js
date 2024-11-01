// user-schema-model.js
const Joi = require('joi');
const Logger = require('../logger/logger');
const log = new Logger('User-Schema-Model');

const loginUserInputSchemaModel = Joi.object({
    username: Joi.string().min(3).required(),
    password: Joi.string().min(8).required()
});

const registerInputUserSchemaModel = Joi.object({
    firstname: Joi.string().min(1).required(),
    lastname: Joi.string().min(1).required(),
    emailId: Joi.string().email().required(),
    dateOfBirth: Joi.date().iso().required(),
    username: Joi.string().min(6).required(),
    password: Joi.string().min(8).required(),
    phoneNo: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
    roleId: Joi.number().default(3),
    address: Joi.object({
        firstline: Joi.string().min(1).required(),
        secondline: Joi.string().min(1).required(),
        city: Joi.string().min(3).required(),
        country: Joi.string().min(3).required(),
        pin: Joi.string().min(6).required()
    }).required()
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

module.exports = {
    registerInputUserSchemaModel,
    loginUserInputSchemaModel,
    updatePasswordInputSchemaModel,
    updateEmailInputSchemaModel,
    updatePhoneNoInputSchemaModel,
    updateAddressInputSchemaModel,
    getUserByUsernameInputSchemaModel,
    getUserByPhoneNoInputSchemaModel
};