// user-dao.js
const Logger = require('../logger/logger');
const log = new Logger('User-Dao');
const { db, users, addresses, roles } = require('./db/schema');
const { eq, and } = require('drizzle-orm');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('config');

const secretKey = getJwtSecretKey();

async function validateLoginUser(loginInfo) {
    try {
        const [user] = await db
            .select({
                id: users.id,
                username: users.username,
                password: users.password,
                roleId: users.roleId
            })
            .from(users)
            .where(eq(users.username, loginInfo.username))
            .limit(1);

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 400;
            error.messageCode = 'USRFE';
            error.userMessage = 'No user found with username ' + loginInfo.username;
            throw error;
        }

        const validPassword = await bcrypt.compare(loginInfo.password, user.password);
        
        if (!validPassword) {
            const error = new Error('Invalid password');
            error.statusCode = 401;
            error.messageCode = 'USRNPI';
            error.userMessage = 'Username/Password incorrect.';
            throw error;
        }

        log.info(loginInfo.username + ' has been validated');
        
        const jwtToken = jwt.sign({
            username: user.username,
            userId: user.id,
            roleId: user.roleId
        }, secretKey);

        return {
            token: jwtToken,
            username: loginInfo.username,
            messageCode: 'USRV',
            message: 'Valid credential.'
        };

    } catch (error) {
        log.error('Error in validateLoginUser:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
            error.messageCode = 'INTERNAL_ERROR';
            error.userMessage = 'An internal server error occurred';
        }
        throw error;
    }
}

async function registerNewUser(userObj) {
    try {
        const hashedPassword = await bcrypt.hash(userObj.password, 10);

        const result = await db.transaction(async (tx) => {
            // Create user
            const [user] = await tx.insert(users).values({
                firstname: userObj.firstname,
                lastname: userObj.lastname,
                emailId: userObj.emailId,
                dateOfBirth: new Date(userObj.dateOfBirth),
                username: userObj.username,
                password: hashedPassword,
                phoneNo: userObj.phoneNo,
                roleId: userObj.roleId || 3 // Default to USER role
            }).returning();

            // Create address
            await tx.insert(addresses).values({
                userId: user.id,
                firstline: userObj.address.firstline,
                secondline: userObj.address.secondline,
                city: userObj.address.city,
                country: userObj.address.country,
                pin: userObj.address.pin
            });

            return user;
        });

        log.info(result.username + ' has been registered');
        return {
            messageCode: 'USRR',
            message: 'You have been registered successfully.',
            username: result.username
        };

    } catch (error) {
        log.error('Error in registerNewUser:', error);
        if (error.code === '23505') { // Unique constraint violation
            const err = new Error('Duplicate user');
            err.statusCode = 400;
            err.messageCode = 'DUPLICATE';
            err.userMessage = 'Username ' + userObj.username + ' already exists.';
            throw err;
        }
        throw error;
    }
}

async function updatePassword(passwordObj) {
    try {
        // Verify user exists with the given details
        const user = await db.query.users.findFirst({
            where: and(
                eq(users.username, passwordObj.username),
                eq(users.emailId, passwordObj.emailId),
                eq(users.dateOfBirth, new Date(passwordObj.dateOfBirth))
            )
        });

        if (!user) {
            const error = new Error('User details do not match');
            error.statusCode = 404;
            error.messageCode = 'DETLSNM';
            error.userMessage = 'Submitted details don\'t match.';
            throw error;
        }

        const hashedPassword = await bcrypt.hash(passwordObj.password, 10);
        
        const [updatedUser] = await db
            .update(users)
            .set({ 
                password: hashedPassword,
                updatedAt: new Date()
            })
            .where(eq(users.id, user.id))
            .returning();

        log.info('Password has been updated for ' + passwordObj.username);
        return {
            messageCode: 'USRPSU',
            message: 'Your password has been successfully updated.'
        };
    } catch (error) {
        log.error('Error in updatePassword:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
            error.messageCode = 'INTERNAL_ERROR';
            error.userMessage = 'An error occurred while updating password';
        }
        throw error;
    }
}

async function updateEmail(emailObj) {
    try {
        const [updatedUser] = await db
            .update(users)
            .set({
                emailId: emailObj.emailId,
                updatedAt: new Date()
            })
            .where(eq(users.username, emailObj.username))
            .returning();

        if (!updatedUser) {
            const error = new Error('User not found');
            error.statusCode = 404;
            error.messageCode = 'DETLSNM';
            error.userMessage = 'Submitted details don\'t match.';
            throw error;
        }

        log.info('Email Id has been updated for ' + emailObj.username);
        return {
            messageCode: 'USRESU',
            message: 'Your email Id has been successfully updated.'
        };
    } catch (error) {
        log.error('Error in updateEmail:', error);
        if (error.code === '23505') {
            const err = new Error('Duplicate email');
            err.statusCode = 400;
            err.messageCode = 'DUPLICATE';
            err.userMessage = 'Email already exists.';
            throw err;
        }
        if (!error.statusCode) {
            error.statusCode = 500;
            error.messageCode = 'INTERNAL_ERROR';
            error.userMessage = 'An error occurred while updating email';
        }
        throw error;
    }
}

async function updatePhoneNo(phoneNoObj) {
    try {
        const [updatedUser] = await db
            .update(users)
            .set({
                phoneNo: phoneNoObj.phoneNo,
                updatedAt: new Date()
            })
            .where(eq(users.username, phoneNoObj.username))
            .returning();

        if (!updatedUser) {
            const error = new Error('User not found');
            error.statusCode = 404;
            error.messageCode = 'DETLSNM';
            error.userMessage = 'Submitted details don\'t match.';
            throw error;
        }

        log.info('Phone no. has been updated for ' + phoneNoObj.username);
        return {
            messageCode: 'USRPHSU',
            message: 'Your phone no. has been successfully updated.'
        };
    } catch (error) {
        log.error('Error in updatePhoneNo:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
            error.messageCode = 'INTERNAL_ERROR';
            error.userMessage = 'An error occurred while updating phone number';
        }
        throw error;
    }
}

async function updateAddress(addressObj) {
    try {
        const user = await db.query.users.findFirst({
            where: eq(users.username, addressObj.username)
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            error.messageCode = 'DETLSNM';
            error.userMessage = 'User not found.';
            throw error;
        }

        const [updatedAddress] = await db
            .update(addresses)
            .set({
                firstline: addressObj.address.firstline,
                secondline: addressObj.address.secondline,
                city: addressObj.address.city,
                country: addressObj.address.country,
                pin: addressObj.address.pin,
                updatedAt: new Date()
            })
            .where(eq(addresses.userId, user.id))
            .returning();

        if (!updatedAddress) {
            const error = new Error('Address not found');
            error.statusCode = 404;
            error.messageCode = 'DETLSNM';
            error.userMessage = 'Address not found.';
            throw error;
        }

        log.info('Address has been updated for ' + addressObj.username);
        return {
            messageCode: 'USRASU',
            message: 'Your address has been successfully updated.'
        };
    } catch (error) {
        log.error('Error in updateAddress:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
            error.messageCode = 'INTERNAL_ERROR';
            error.userMessage = 'An error occurred while updating address';
        }
        throw error;
    }
}

async function getUserByUsername(username) {
    try {
        const user = await db.query.users.findFirst({
            where: eq(users.username, username),
            with: {
                role: true,
                address: true
            }
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            error.messageCode = 'USRFE';
            error.userMessage = 'No user found by username ' + username;
            throw error;
        }

        log.info('Retrieving user details by username ' + username);
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    } catch (error) {
        log.error('Error in getUserByUsername:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
            error.messageCode = 'INTERNAL_ERROR';
            error.userMessage = 'An error occurred while retrieving user';
        }
        throw error;
    }
}

async function getUserByPhoneNo(phoneNo) {
    try {
        const user = await db.query.users.findFirst({
            where: eq(users.phoneNo, phoneNo),
            with: {
                role: true,
                address: true
            }
        });

        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            error.messageCode = 'USRFE';
            error.userMessage = 'No user found by phone no. ' + phoneNo;
            throw error;
        }

        log.info('Retrieving user details by phone no. ' + phoneNo);
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    } catch (error) {
        log.error('Error in getUserByPhoneNo:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
            error.messageCode = 'INTERNAL_ERROR';
            error.userMessage = 'An error occurred while retrieving user';
        }
        throw error;
    }
}

async function assignRole(username, roleId) {
    try {
        const [updatedUser] = await db
            .update(users)
            .set({
                roleId: roleId,
                updatedAt: new Date()
            })
            .where(eq(users.username, username))
            .returning();

        if (!updatedUser) {
            const error = new Error('User not found');
            error.statusCode = 404;
            error.messageCode = 'USRFE';
            error.userMessage = 'No user found by username ' + username;
            throw error;
        }

        log.info(`Role ${roleId} assigned to user ${username}`);
        return {
            messageCode: 'ROLE_ASSIGNED',
            message: 'Role has been successfully assigned to the user'
        };
    } catch (error) {
        log.error('Error in assignRole:', error);
        if (error.code === '23503') { // Foreign key violation
            const err = new Error('Invalid role ID');
            err.statusCode = 400;
            err.messageCode = 'INVALID_ROLE';
            err.userMessage = 'The specified role does not exist';
            throw err;
        }
        if (!error.statusCode) {
            error.statusCode = 500;
            error.messageCode = 'INTERNAL_ERROR';
            error.userMessage = 'An error occurred while assigning role';
        }
        throw error;
    }
}

function getJwtSecretKey() {
    try {
        return config.get('jwt.secretkey');
    } catch (err) {
        console.error('\x1b[31mUnable to start application without JWT secret key. Please set "bankingapp-secretkey" in environment variable and try again.\x1b[0m');
        process.exit(0);
    }
}

module.exports = {
    validateLoginUser,
    registerNewUser,
    updatePassword,
    updateEmail,
    updatePhoneNo,
    updateAddress,
    getUserByUsername,
    getUserByPhoneNo,
    assignRole
};