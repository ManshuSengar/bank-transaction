// user-schema-validator.js
const userSchemaModel = require('./user-schema-model');

const validateLoginUserSchema = (loginUser) => {
    return userSchemaModel.loginUserInputSchemaModel.validate(loginUser);
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


const validateNewUserSchema = (newUser) => {
    return userSchemaModel.registerInputUserSchemaModel.validate(newUser);
};

const validateForgotPasswordSchema = (forgotPasswordData) => {
    return userSchemaModel.forgotPasswordInputSchemaModel.validate(forgotPasswordData);
};

const validateResetPasswordSchema = (resetPasswordData) => {
    return userSchemaModel.resetPasswordInputSchemaModel.validate(resetPasswordData);
};

const validateChangePasswordSchema = (changePasswordData) => {
    return userSchemaModel.changePasswordInputSchemaModel.validate(changePasswordData);
};

const validateAddressSchema = (address) => {
    return userSchemaModel.addressInputSchemaModel.validate(address);
};

const validateBusinessInformationSchema = (businessInfo) => {
    return userSchemaModel.businessInformationInputSchemaModel.validate(businessInfo);
};

const validateGetAllUsersSchema = (queryParams) => {
    const schema = Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional()
    });

    return schema.validate(queryParams);
};


module.exports = {
    validateLoginUserSchema,
    validateNewUserSchema,
    validateUpdatePasswordSchema,
    validateUpdateEmailSchema,
    validateUpdatePhoneNoSchema,
    validateUpdateAddressSchema,
    validateUserByUsernameSchema,
    validateUserByPhoneNoSchema,
    validateBusinessInformationSchema,
    validateAddressSchema,
    validateChangePasswordSchema,
    validateResetPasswordSchema,
    validateForgotPasswordSchema,
    validateGetAllUsersSchema

};