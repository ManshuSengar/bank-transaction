// user-schema-validator.js
const userSchemaModel = require('./user-schema-model');

const validateLoginUserSchema = (loginUser) => {
    return userSchemaModel.loginUserInputSchemaModel.validate(loginUser);
}

const validateNewUserSchema = (newUser) => {
    return userSchemaModel.registerInputUserSchemaModel.validate(newUser);
}

const validateUpdatePasswordSchema = (updatePassword) => {
    return userSchemaModel.updatePasswordInputSchemaModel.validate(updatePassword);
}

const validateUpdateEmailSchema = (updateEmail) => {
    return userSchemaModel.updateEmailInputSchemaModel.validate(updateEmail);
}

const validateUpdatePhoneNoSchema = (updatePhoneNo) => {
    return userSchemaModel.updatePhoneNoInputSchemaModel.validate(updatePhoneNo);
}

const validateUpdateAddressSchema = (user) => {
    return userSchemaModel.updateAddressInputSchemaModel.validate(user);
}

const validateUserByUsernameSchema = (username) => {
    return userSchemaModel.getUserByUsernameInputSchemaModel.validate(username);
}

const validateUserByPhoneNoSchema = (phoneNo) => {
    return userSchemaModel.getUserByPhoneNoInputSchemaModel.validate(phoneNo);
}

module.exports = {
    validateLoginUserSchema,
    validateNewUserSchema,
    validateUpdatePasswordSchema,
    validateUpdateEmailSchema,
    validateUpdatePhoneNoSchema,
    validateUpdateAddressSchema,
    validateUserByUsernameSchema,
    validateUserByPhoneNoSchema
};