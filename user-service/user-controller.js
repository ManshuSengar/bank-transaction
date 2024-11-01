// user-controller.js
const express = require('express');
const userrouter = express.Router();
const userValidator = require('./user-schema-validator');
const userDao = require('./user-dao');
const Logger = require('../logger/logger');
const log = new Logger('User-Controller');
const { authenticateToken, authorize } = require('../middleware/auth-token-validator');

// Public routes
userrouter.post('/register', async (req, res) => {
    try {
        let userObj = req.body;
        let { error } = userValidator.validateNewUserSchema(userObj);
        if (isNotValidSchema(error, res)) return;

        const result = await userDao.registerNewUser(userObj);
        return res.status(201).send(result);
    } catch (err) {
        log.error(`Error in registering new user with username ${userObj?.username}: ${err}`);
        return res.status(err.statusCode || 500).send({
            messageCode: err.messageCode || 'INTERNAL_ERROR',
            message: err.userMessage || 'An error occurred while registering the user',
            error: err.message
        });
    }
});

userrouter.post('/validateuser', async (req, res) => {
    try {
        let loginInfo = req.body;
        let { error } = userValidator.validateLoginUserSchema(loginInfo);
        if (isNotValidSchema(error, res)) return;

        const result = await userDao.validateLoginUser(loginInfo);
        return res
            .header('x-auth-token', result.token)
            .send({
                username: result.username,
                messageCode: result.messageCode,
                message: result.message
            });
    } catch (err) {
        log.error(`Error in login for username : ${err}`);
        return res.status(err.statusCode || 500).send({
            messageCode: err.messageCode || 'INTERNAL_ERROR',
            message: err.userMessage || 'An error occurred during login',
            error: err.message
        });
    }
});

// Protected routes with role-based access
userrouter.post('/updatepassword', authenticateToken, async (req, res) => {
    try {
        let passwordObj = req.body;
        let { error } = userValidator.validateUpdatePasswordSchema(passwordObj);
        if (isNotValidSchema(error, res)) return;

        // Check if user is updating their own password or has admin permission
        if (req.user.username !== passwordObj.username && !req.user.permissions.includes('manage_users')) {
            return res.status(403).send({
                messageCode: 'FORBIDDEN',
                message: 'You can only update your own password'
            });
        }

        const result = await userDao.updatePassword(passwordObj);
        return res.send(result);
    } catch (err) {
        log.error(`Error in updating password for username ${passwordObj?.username}: ${err}`);
        return res.status(err.statusCode || 500).send({
            messageCode: err.messageCode || 'INTERNAL_ERROR',
            message: err.userMessage || 'An error occurred while updating password',
            error: err.message
        });
    }
});

userrouter.post('/updateemail', authenticateToken, async (req, res) => {
    try {
        let emailObj = req.body;
        let { error } = userValidator.validateUpdateEmailSchema(emailObj);
        if (isNotValidSchema(error, res)) return;

        // Check if user is updating their own email or has admin permission
        if (req.user.username !== emailObj.username && !req.user.permissions.includes('manage_users')) {
            return res.status(403).send({
                messageCode: 'FORBIDDEN',
                message: 'You can only update your own email'
            });
        }

        const result = await userDao.updateEmail(emailObj);
        return res.send(result);
    } catch (err) {
        log.error(`Error in updating email for username ${emailObj?.username}: ${err}`);
        return res.status(err.statusCode || 500).send({
            messageCode: err.messageCode || 'INTERNAL_ERROR',
            message: err.userMessage || 'An error occurred while updating email',
            error: err.message
        });
    }
});

userrouter.post('/updatephoneno', authenticateToken, async (req, res) => {
    try {
        let phoneNoObj = req.body;
        let { error } = userValidator.validateUpdatePhoneNoSchema(phoneNoObj);
        if (isNotValidSchema(error, res)) return;

        // Check if user is updating their own phone number or has admin permission
        if (req.user.username !== phoneNoObj.username && !req.user.permissions.includes('manage_users')) {
            return res.status(403).send({
                messageCode: 'FORBIDDEN',
                message: 'You can only update your own phone number'
            });
        }

        const result = await userDao.updatePhoneNo(phoneNoObj);
        return res.send(result);
    } catch (err) {
        log.error(`Error in updating phone no. for username ${phoneNoObj?.username}: ${err}`);
        return res.status(err.statusCode || 500).send({
            messageCode: err.messageCode || 'INTERNAL_ERROR',
            message: err.userMessage || 'An error occurred while updating phone number',
            error: err.message
        });
    }
});

userrouter.post('/updateaddress', authenticateToken, async (req, res) => {
    try {
        let addressObj = req.body;
        let { error } = userValidator.validateUpdateAddressSchema(addressObj);
        if (isNotValidSchema(error, res)) return;

        // Check if user is updating their own address or has admin permission
        if (req.user.username !== addressObj.username && !req.user.permissions.includes('manage_users')) {
            return res.status(403).send({
                messageCode: 'FORBIDDEN',
                message: 'You can only update your own address'
            });
        }

        const result = await userDao.updateAddress(addressObj);
        return res.send(result);
    } catch (err) {
        log.error(`Error in updating address for username ${addressObj?.username}: ${err}`);
        return res.status(err.statusCode || 500).send({
            messageCode: err.messageCode || 'INTERNAL_ERROR',
            message: err.userMessage || 'An error occurred while updating address',
            error: err.message
        });
    }
});

// Admin and Manager routes
userrouter.get('/getuserbyusername/:username',
    authenticateToken,
    authorize(['view_users', 'manage_users']),
    async (req, res) => {
        try {
            let username = req.params.username;
            let { error } = userValidator.validateUserByUsernameSchema({ username });
            if (isNotValidSchema(error, res)) return;

            const result = await userDao.getUserByUsername(username);
            return res.send(result);
        } catch (err) {
            log.error(`Error in retrieving user by username ${username}: ${err}`);
            return res.status(err.statusCode || 500).send({
                messageCode: err.messageCode || 'INTERNAL_ERROR',
                message: err.userMessage || 'An error occurred while retrieving user',
                error: err.message
            });
        }
    });

userrouter.get('/getuserbyphoneno/:phoneNo',
    authenticateToken,
    authorize(['view_users', 'manage_users']),
    async (req, res) => {
        try {
            let phoneNo = req.params.phoneNo;
            let { error } = userValidator.validateUserByPhoneNoSchema({ phoneNo });
            if (isNotValidSchema(error, res)) return;

            const result = await userDao.getUserByPhoneNo(phoneNo);
            return res.send(result);
        } catch (err) {
            log.error(`Error in retrieving user by phone no. ${phoneNo}: ${err}`);
            return res.status(err.statusCode || 500).send({
                messageCode: err.messageCode || 'INTERNAL_ERROR',
                message: err.userMessage || 'An error occurred while retrieving user',
                error: err.message
            });
        }
    });

// Admin only routes
userrouter.post('/assignrole',
    authenticateToken,
    authorize(['manage_roles']),
    async (req, res) => {
        try {
            const { username, roleId } = req.body;
            const result = await userDao.assignRole(username, roleId);
            return res.send(result);
        } catch (err) {
            log.error(`Error in assigning role: ${err}`);
            return res.status(err.statusCode || 500).send({
                messageCode: err.messageCode || 'INTERNAL_ERROR',
                message: err.userMessage || 'An error occurred while assigning role',
                error: err.message
            });
        }
    });

function isNotValidSchema(error, res) {
    if (error) {
        log.error(`Schema validation error: ${error.details[0].message}`);
        res.status(400).send({
            messageCode: 'VALDERR',
            message: error.details[0].message
        });
        return true;
    }
    return false;
}

module.exports = userrouter;