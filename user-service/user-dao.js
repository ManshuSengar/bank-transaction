// user-dao.js
const Logger = require("../logger/logger");
const log = new Logger("User-Dao");
const {
  db,
  users,
  addresses,
  roles,
  businessInformation,
  userSessions,
  userActivityLogs,
  userLoginHistory,
  permissions,
  rolePermissions,
  schemes,
  schemeCharges,
  products,
  apiConfigs
} = require("./db/schema");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const config = require("config");
const crypto = require("crypto");
const emailService = require("../email-service/email-controller");
const { generateRandomPassword } = require("./utlis/password-utlis");
const { eq, like, and, or, between, sql, desc } = require("drizzle-orm");
const secretKey = getJwtSecretKey();
const { getUserPermissions } = require("../middleware/auth-token-validator");

const walletDao = require("../wallet-service/wallet-dao");

const validateLoginUser = async (loginInfo, ipAddress, userAgent) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        password: users.password,
        roleId: users.roleId,
      })
      .from(users)
      .where(eq(users.username, loginInfo.username))
      .limit(1);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 400;
      error.messageCode = "USRFE";
      error.userMessage = "No user found with username " + loginInfo.username;
      throw error;
    }

    const validPassword = await bcrypt.compare(
      loginInfo.password,
      user.password
    );

    if (!validPassword) {
      await db.insert(userLoginHistory).values({
        userId: user.id,
        ipAddress,
        userAgent,
        loginStatus: "FAILED",
        failureReason: "Invalid password",
        latitude: loginInfo.location?.latitude || null,
        longitude: loginInfo.location?.longitude || null,
      });

      const error = new Error("Invalid password");
      error.statusCode = 401;
      error.messageCode = "USRNPI";
      error.userMessage = "Username/Password incorrect.";
      throw error;
    }

    // Update user's last login information
    await db
      .update(users)
      .set({
        lastLogin: new Date(),
        lastLoginIp: ipAddress,
        lastLoginLocation: loginInfo.location
          ? JSON.stringify(loginInfo.location)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Create user session with all details
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const [session] = await db
      .insert(userSessions)
      .values({
        userId: user.id,
        sessionToken,
        deviceInfo: userAgent,
        ipAddress,
        userAgent,
        latitude: loginInfo.location?.latitude || null,
        longitude: loginInfo.location?.longitude || null,
        expiresAt,
        lastActivityAt: new Date(),
      })
      .returning();

    // Log successful login in history
    await db.insert(userLoginHistory).values({
      userId: user.id,
      ipAddress,
      userAgent,
      deviceInfo: userAgent,
      loginStatus: "SUCCESS",
      latitude: loginInfo.location?.latitude || null,
      longitude: loginInfo.location?.longitude || null,
    });

    // Log login activity
    await db.insert(userActivityLogs).values({
      userId: user.id,
      sessionId: session.id,
      activityType: "LOGIN",
      description: "User logged in successfully",
      ipAddress,
      userAgent,
      latitude: loginInfo.location?.latitude || null,
      longitude: loginInfo.location?.longitude || null,
    });

    log.info(loginInfo.username + " has been validated");

    const jwtToken = jwt.sign(
      {
        username: user.username,
        userId: user.id,
        roleId: user.roleId,
        sessionId: session.id, // Include session ID in token
      },
      secretKey
    );
    const [role] = await db
      .select({
        id: roles.id,
        name: roles.name,
      })
      .from(roles)
      .where(eq(roles.id, user.roleId))
      .limit(1);

    // Fetch user's permissions
    const userPermissions = await db
      .select({
        name: permissions.name,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, user.roleId));

    return {
      token: jwtToken,
      username: loginInfo.username,
      role: {
        id: role.id,
        name: role.name,
      },
      permissions: userPermissions.map((p) => p.name),
      messageCode: "USRV",
      message: "Valid credential.",
    };
  } catch (error) {
    log.error("Error in validateLoginUser:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
      error.messageCode = "INTERNAL_ERROR";
      error.userMessage = "An internal server error occurred";
    }
    throw error;
  }
};

async function registerNewUser(userObj) {
  try {
    const randomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const result = await db.transaction(async (tx) => {
      // First create the user
      const [user] = await tx
        .insert(users)
        .values({
          firstname: userObj.firstname,
          lastname: userObj.lastname,
          emailId: userObj.emailId,
          dateOfBirth: new Date(userObj.dateOfBirth),
          username: userObj.username,
          password: hashedPassword,
          phoneNo: userObj.phoneNo,
          roleId: userObj.roleId || 10,
        })
        .returning();

      // Create address
      await tx.insert(addresses).values({
        userId: user.id,
        firstline: userObj.address.firstline,
        secondline: userObj.address.secondline,
        city: userObj.address.city,
        country: userObj.address.country,
        pin: userObj.address.pin,
      });

      // Create business information
      await tx.insert(businessInformation).values({
        userId: user.id,
        shopName: userObj.businessInformation.shopName,
        pancardNumber: userObj.businessInformation.pancardNumber.toUpperCase(),
        adhaarNumber: userObj.businessInformation.adhaarNumber,
        businessEmail: userObj.businessInformation.businessEmail,
        businessDomain: userObj.businessInformation.businessDomain,
        rmCode: userObj.businessInformation.rmCode,
      });

      // Initialize wallets within the same transaction
      await walletDao.initializeUserWallets(user.id, tx); // Pass the transaction object

      // Send welcome email
      console.log("randomPassword--> ", randomPassword);
      await emailService.sendWelcomeEmail(
        { ...user, password: randomPassword },
        randomPassword
      );

      return user;
    });

    log.info(result.username + " has been registered");
    return {
      messageCode: "USRR",
      message:
        "You have been registered successfully. Please check your email for login credentials.",
      username: result.username,
    };
  } catch (error) {
    log.error("Error in registerNewUser:", error);
    if (error.code === "23505") {
      const err = new Error("Duplicate entry found");
      err.statusCode = 400;
      err.messageCode = "DUPLICATE";
      err.userMessage =
        "A user with this username, PAN, or Adhaar number already exists.";
      throw err;
    }
    throw error;
  }
}

async function updatePassword(passwordObj) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.username, passwordObj.username),
          eq(users.emailId, passwordObj.emailId),
          eq(users.dateOfBirth, new Date(passwordObj.dateOfBirth))
        )
      )
      .limit(1);

    if (!user) {
      const error = new Error("User details do not match");
      error.statusCode = 404;
      error.messageCode = "DETLSNM";
      error.userMessage = "Submitted details don't match.";
      throw error;
    }

    const hashedPassword = await bcrypt.hash(passwordObj.password, 10);

    const [updatedUser] = await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    log.info("Password has been updated for " + passwordObj.username);
    return {
      messageCode: "USRPSU",
      message: "Your password has been successfully updated.",
    };
  } catch (error) {
    log.error("Error in updatePassword:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
      error.messageCode = "INTERNAL_ERROR";
      error.userMessage = "An error occurred while updating password";
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
        updatedAt: new Date(),
      })
      .where(eq(users.username, emailObj.username))
      .returning();

    if (!updatedUser) {
      const error = new Error("User not found");
      error.statusCode = 404;
      error.messageCode = "DETLSNM";
      error.userMessage = "Submitted details don't match.";
      throw error;
    }

    log.info("Email Id has been updated for " + emailObj.username);
    return {
      messageCode: "USRESU",
      message: "Your email Id has been successfully updated.",
    };
  } catch (error) {
    log.error("Error in updateEmail:", error);
    if (error.code === "23505") {
      const err = new Error("Duplicate email");
      err.statusCode = 400;
      err.messageCode = "DUPLICATE";
      err.userMessage = "Email already exists.";
      throw err;
    }
    if (!error.statusCode) {
      error.statusCode = 500;
      error.messageCode = "INTERNAL_ERROR";
      error.userMessage = "An error occurred while updating email";
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
        updatedAt: new Date(),
      })
      .where(eq(users.username, phoneNoObj.username))
      .returning();

    if (!updatedUser) {
      const error = new Error("User not found");
      error.statusCode = 404;
      error.messageCode = "DETLSNM";
      error.userMessage = "Submitted details don't match.";
      throw error;
    }

    log.info("Phone no. has been updated for " + phoneNoObj.username);
    return {
      messageCode: "USRPHSU",
      message: "Your phone no. has been successfully updated.",
    };
  } catch (error) {
    log.error("Error in updatePhoneNo:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
      error.messageCode = "INTERNAL_ERROR";
      error.userMessage = "An error occurred while updating phone number";
    }
    throw error;
  }
}

async function updateAddress(addressObj) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, addressObj.username))
      .limit(1);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      error.messageCode = "DETLSNM";
      error.userMessage = "User not found.";
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
        updatedAt: new Date(),
      })
      .where(eq(addresses.userId, user.id))
      .returning();

    if (!updatedAddress) {
      const error = new Error("Address not found");
      error.statusCode = 404;
      error.messageCode = "DETLSNM";
      error.userMessage = "Address not found.";
      throw error;
    }

    log.info("Address has been updated for " + addressObj.username);
    return {
      messageCode: "USRASU",
      message: "Your address has been successfully updated.",
    };
  } catch (error) {
    log.error("Error in updateAddress:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
      (error.messageCode = "INTERNAL_ERROR"),
        (error.userMessage = "An error occurred while updating address");
    }
    throw error;
  }
}

async function getUserByUsername(username) {
  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        firstname: users.firstname,
        lastname: users.lastname,
        emailId: users.emailId,
        dateOfBirth: users.dateOfBirth,
        phoneNo: users.phoneNo,
        roleId: users.roleId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        role: roles,
        address: addresses,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(addresses, eq(users.id, addresses.userId))
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      error.messageCode = "USRFE";
      error.userMessage = "No user found by username " + username;
      throw error;
    }

    log.info("Retrieving user details by username " + username);
    return user;
  } catch (error) {
    log.error("Error in getUserByUsername:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
      error.messageCode = "INTERNAL_ERROR";
      error.userMessage = "An error occurred while retrieving user";
    }
    throw error;
  }
}

async function getUserByPhoneNo(phoneNo) {
  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        firstname: users.firstname,
        lastname: users.lastname,
        emailId: users.emailId,
        dateOfBirth: users.dateOfBirth,
        phoneNo: users.phoneNo,
        roleId: users.roleId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        role: roles,
        address: addresses,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(addresses, eq(users.id, addresses.userId))
      .where(eq(users.phoneNo, phoneNo))
      .limit(1);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      error.messageCode = "USRFE";
      error.userMessage = "No user found by phone no. " + phoneNo;
      throw error;
    }

    log.info("Retrieving user details by phone no. " + phoneNo);
    return user;
  } catch (error) {
    log.error("Error in getUserByPhoneNo:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
      error.messageCode = "INTERNAL_ERROR";
      error.userMessage = "An error occurred while retrieving user";
    }
    throw error;
  }
}

async function forgotPassword(emailId) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.emailId, emailId))
      .limit(1);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      error.messageCode = "USER_NOT_FOUND";
      error.userMessage = "No user found with this email address";
      throw error;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await db
      .update(users)
      .set({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await emailService.sendPasswordResetEmail(user, resetToken);

    return {
      messageCode: "RESET_EMAIL_SENT",
      message: "Password reset instructions have been sent to your email",
    };
  } catch (error) {
    log.error("Error in forgotPassword:", error);
    throw error;
  }
}

async function resetPassword(token, newPassword) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.passwordResetToken, token))
      .limit(1);

    if (!user || user.passwordResetExpires < new Date()) {
      const error = new Error("Invalid or expired reset token");
      error.statusCode = 400;
      error.messageCode = "INVALID_TOKEN";
      error.userMessage = "Password reset token is invalid or has expired";
      throw error;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db
      .update(users)
      .set({
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return {
      messageCode: "PASSWORD_RESET",
      message: "Your password has been successfully reset",
    };
  } catch (error) {
    log.error("Error in resetPassword:", error);
    throw error;
  }
}

async function changePassword(userId, currentPassword, newPassword) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      error.messageCode = "USER_NOT_FOUND";
      error.userMessage = "User not found";
      throw error;
    }

    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isValidPassword) {
      const error = new Error("Invalid current password");
      error.statusCode = 400;
      error.messageCode = "INVALID_PASSWORD";
      error.userMessage = "Current password is incorrect";
      throw error;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return {
      messageCode: "PASSWORD_CHANGED",
      message: "Your password has been successfully changed",
    };
  } catch (error) {
    log.error("Error in changePassword:", error);
    throw error;
  }
}

async function assignRole(username, roleId) {
  try {
    const [updatedUser] = await db
      .update(users)
      .set({
        roleId: roleId,
        updatedAt: new Date(),
      })
      .where(eq(users.username, username))
      .returning();

    if (!updatedUser) {
      const error = new Error("User not found");
      error.statusCode = 404;
      error.messageCode = "USRFE";
      error.userMessage = "No user found by username " + username;
      throw error;
    }

    log.info(`Role ${roleId} assigned to user ${username}`);
    return {
      messageCode: "ROLE_ASSIGNED",
      message: "Role has been successfully assigned to the user",
    };
  } catch (error) {
    log.error("Error in assignRole:", error);
    if (error.code === "23503") {
      // Foreign key violation
      const err = new Error("Invalid role ID");
      err.statusCode = 400;
      err.messageCode = "INVALID_ROLE";
      err.userMessage = "The specified role does not exist";
      throw err;
    }
    if (!error.statusCode) {
      error.statusCode = 500;
      error.messageCode = "INTERNAL_ERROR";
      error.userMessage = "An error occurred while assigning role";
    }
    throw error;
  }
}

function getJwtSecretKey() {
  try {
    return config.get("jwt.secretkey");
  } catch (err) {
    console.error(
      '\x1b[31mUnable to start application without JWT secret key. Please set "bankingapp-secretkey" in environment variable and try again.\x1b[0m'
    );
    process.exit(0);
  }
}

async function getAllUsers(page = 1, limit = 10) {
  try {
    const offset = (page - 1) * limit;
    log.info("Retrieved list of users");
    const userData = await db
      .select({
        id: users.id,
        username: users.username,
        firstname: users.firstname,
        lastname: users.lastname,
        emailId: users.emailId,
        phoneNo: users.phoneNo,
        roleId: users.roleId,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
        role: roles,
        address: addresses,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(addresses, eq(users.id, addresses.userId))
      .limit(limit)
      .offset(offset);

    // Import required schemas from scheme service
    const { schemes, userSchemes, schemeCharges, apiConfigs } = require('../scheme-service/db/schema');
    const { products } = require('../product-service/db/schema');

    // Get wallet balances and schemes for each user
    const userDataWithDetails = await Promise.all(
      userData.map(async (user) => {
        // Get wallet information
        const wallets = await walletDao.getUserWallets(user.id);
        const serviceWallet = wallets.find((w) => w.type.name === "SERVICE");
        const collectionWallet = wallets.find(
          (w) => w.type.name === "COLLECTION"
        );

        // Get user schemes with complete details
        const userSchemeResults = await db
          .select()
          .from(userSchemes)
          .leftJoin(schemes, eq(userSchemes.schemeId, schemes.id))
          .leftJoin(products, eq(schemes.productId, products.id))
          .leftJoin(
            schemeCharges,
            and(
              eq(schemes.id, schemeCharges.schemeId),
              eq(schemeCharges.status, "ACTIVE")
            )
          )
          .leftJoin(apiConfigs, eq(schemeCharges.apiConfigId, apiConfigs.id))
          .where(
            and(
              eq(userSchemes.userId, user.id),
              eq(userSchemes.status, "ACTIVE")
            )
          );

        // Process and group schemes
        const schemesMap = new Map();
        
        userSchemeResults.forEach((row) => {
          if (!schemesMap.has(row.schemes.id)) {
            schemesMap.set(row.schemes.id, {
              ...row.schemes,
              product: {
                id: row.products.id,
                name: row.products.name
              },
              assignmentId: row.user_schemes.id,
              assignedAt: row.user_schemes.createdAt,
              charges: []
            });
          }

          const scheme = schemesMap.get(row.schemes.id);
          if (row.scheme_charges && !scheme.charges.some(c => c.id === row.scheme_charges.id)) {
            scheme.charges.push({
              ...row.scheme_charges,
              api: row.api_configs
            });
          }
        });

        return {
          ...user,
          wallets: {
            serviceBalance: serviceWallet ? serviceWallet.wallet.balance : 0,
            collectionBalance: collectionWallet
              ? collectionWallet.wallet.balance
              : 0,
          },
          schemes: Array.from(schemesMap.values())
        };
      })
    );

    const [{ count }] = await db.select({ count: sql`COUNT(*)` }).from(users);

    log.info("Retrieved list of users with schemes");
    return {
      userData: userDataWithDetails,
      pagination: {
        currentPage: page,
        totalUsers: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
        pageSize: limit,
      },
    };
  } catch (error) {
    console.log("Error in getAllUsers:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
      error.messageCode = "INTERNAL_ERROR";
      error.userMessage = "An error occurred while retrieving users";
    }
    throw error;
  }
}

async function toggleUserStatus(userId) {
  try {
    // Get current user status
    const [currentUser] = await db
      .select({
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!currentUser) {
      const error = new Error("User not found");
      error.statusCode = 404;
      error.messageCode = "USER_NOT_FOUND";
      error.userMessage = "User not found";
      throw error;
    }

    // Toggle the status
    await db
      .update(users)
      .set({
        isActive: !currentUser.isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Return success response
    return {
      success: true,
      isActive: !currentUser.isActive
    };

  } catch (error) {
    log.error("Error toggling user status:", error);
    throw error;
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
  assignRole,
  forgotPassword,
  resetPassword,
  changePassword,
  getAllUsers,
  toggleUserStatus,
};