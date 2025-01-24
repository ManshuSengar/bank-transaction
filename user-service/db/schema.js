// db/schema.js
const { 
    pgTable, 
    serial, 
    varchar, 
    timestamp, 
    text, 
    integer, 
    unique, 
    boolean,
    decimal,
    real
} = require('drizzle-orm/pg-core');
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const config = require('config');

// Database connection
const pool = new Pool({
    host: config.get('postgres-config.host'),
    port: config.get('postgres-config.port'),
    user: config.get('postgres-config.user'),
    password: config.get('postgres-config.password'),
    database: config.get('postgres-config.database')
});

const db = drizzle(pool);

// Roles table
const roles = pgTable('roles', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 50 }).notNull().unique(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Permissions table
const permissions = pgTable('permissions', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Role-Permission relationship table
const rolePermissions = pgTable('role_permissions', {
    id: serial('id').primaryKey(),
    roleId: integer('role_id').references(() => roles.id).notNull(),
    permissionId: integer('permission_id').references(() => permissions.id).notNull(),
    createdAt: timestamp('created_at').defaultNow()
}, (table) => {
    return {
        unq: unique().on(table.roleId, table.permissionId)
    };
});

// User-Permission relationship table
const userPermissions = pgTable('user_permissions', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    permissionId: integer('permission_id').references(() => permissions.id).notNull(),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => {
    return {
        unq: unique().on(table.userId, table.permissionId)
    };
});

// Addresses table
const addresses = pgTable('addresses', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    firstline: varchar('firstline', { length: 255 }).notNull(),
    secondline: varchar('secondline', { length: 255 }),
    city: varchar('city', { length: 100 }).notNull(),
    state: varchar('state', { length: 100 }),
    country: varchar('country', { length: 100 }).notNull(),
    pin: varchar('pin', { length: 10 }).notNull(),
    addressType: varchar('address_type', { length: 50 }).default('HOME'),
    isPrimary: boolean('is_primary').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Business Information table
const businessInformation = pgTable('business_information', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    shopName: varchar('shop_name', { length: 100 }).notNull(),
    pancardNumber: varchar('pancard_number', { length: 10 }).notNull().unique(),
    adhaarNumber: varchar('adhaar_number', { length: 12 }).notNull().unique(),
    businessEmail: varchar('business_email', { length: 255 }),
    businessDomain: varchar('business_domain', { length: 255 }),
    rmCode: varchar('rm_code', { length: 50 }),
    businessType: varchar('business_type', { length: 50 }),
    businessCategory: varchar('business_category', { length: 100 }),
    gstNumber: varchar('gst_number', { length: 15 }),
    establishmentYear: integer('establishment_year'),
    annualTurnover: decimal('annual_turnover', { precision: 15, scale: 2 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => {
    return {
        unq: unique().on(table.userId)
    };
});

// User Login History table
const userLoginHistory = pgTable('user_login_history', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    loginTime: timestamp('login_time').defaultNow(),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    userAgent: text('user_agent'),
    deviceInfo: text('device_info'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    loginStatus: varchar('login_status', { length: 20 }).notNull(),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at').defaultNow()
});

const userSessions = pgTable('user_sessions', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    sessionToken: varchar('session_token', { length: 255 }).notNull(),
    deviceInfo: text('device_info'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    loginAt: timestamp('login_at').defaultNow(),
    lastActivityAt: timestamp('last_activity_at').defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow()
});

// User Activity Logs table
const userActivityLogs = pgTable('user_activity_logs', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    sessionId: integer('session_id').references(() => userSessions.id),
    activityType: varchar('activity_type', { length: 50 }).notNull(),
    description: text('description'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    createdAt: timestamp('created_at').defaultNow()
});

// Users table (updated)
const users = pgTable('users', {
    id: serial('id').primaryKey(),
    firstname: varchar('firstname', { length: 100 }).notNull(),
    lastname: varchar('lastname', { length: 100 }).notNull(),
    emailId: varchar('email_id', { length: 255 }).notNull().unique(),
    username: varchar('username', { length: 100 }).notNull().unique(),
    dateOfBirth: timestamp('date_of_birth').notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    phoneNo: varchar('phone_no', { length: 10 }).notNull(),
    roleId: integer('role_id').references(() => roles.id).notNull(),
    passwordResetToken: varchar('password_reset_token', { length: 255 }),
    passwordResetExpires: timestamp('password_reset_expires'),
    failedLoginAttempts: integer('failed_login_attempts').default(0),
    accountLockTime: timestamp('account_lock_time'),
    lastLogin: timestamp('last_login'),
    lastLoginIp: varchar('last_login_ip', { length: 45 }),
    lastLoginLocation: text('last_login_location'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

module.exports = {
    db,
    users,
    roles,
    permissions,
    rolePermissions,
    userPermissions,
    addresses,
    businessInformation,
    userSessions,
    userActivityLogs,
    userLoginHistory  
};