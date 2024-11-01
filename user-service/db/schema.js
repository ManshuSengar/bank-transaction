// db/schema.js
const { pgTable, serial, varchar, timestamp, text, integer, unique } = require('drizzle-orm/pg-core');
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const config = require('config');

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

// Users table
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
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Addresses table
const addresses = pgTable('addresses', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    firstline: varchar('firstline', { length: 255 }).notNull(),
    secondline: varchar('secondline', { length: 255 }),
    city: varchar('city', { length: 100 }).notNull(),
    country: varchar('country', { length: 100 }).notNull(),
    pin: varchar('pin', { length: 10 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Database connection
console.log("config.get('postgres-config.host')--> ",config.get('postgres-config.host'));
const pool = new Pool({
    host: config.get('postgres-config.host'),
    port: config.get('postgres-config.port'),
    user: config.get('postgres-config.user'),
    password: config.get('postgres-config.password'),
    database: config.get('postgres-config.database')
});

console.log("pool--> ",pool);
const db = drizzle(pool);

module.exports = {
    db,
    users,
    roles,
    permissions,
    rolePermissions,
    addresses
};