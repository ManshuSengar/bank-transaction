const { pgTable, serial, varchar, timestamp, decimal, integer } = require('drizzle-orm/pg-core');
const { drizzle } = require('drizzle-orm/node-postgres');
const { users } = require('../../user-service/db/schema');
const config = require('config');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    host: config.get('postgres-config.host'),
    port: config.get('postgres-config.port'),
    user: config.get('postgres-config.user'),
    password: config.get('postgres-config.password'),
    database: config.get('postgres-config.database')
});

const db = drizzle(pool);

// Schemes table
const schemes = pgTable('schemes', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    status: varchar('status', { length: 20 }).default('INACTIVE'),
    createdBy: integer('created_by').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Scheme charges table
const schemeCharges = pgTable('scheme_charges', {
    id: serial('id').primaryKey(),
    schemeId: integer('scheme_id').references(() => schemes.id).notNull(),
    payoutRange: varchar('payout_range', { length: 50 }).notNull(), // e.g. "100-500"
    chargeType: varchar('charge_type', { length: 20 }).notNull(), // FLAT, PERCENTAGE
    chargeValue: decimal('charge_value', { precision: 10, scale: 2 }).notNull(),
    partnerValue: decimal('partner_value', { precision: 10, scale: 2 }),
    apiuserValue: decimal('apiuser_value', { precision: 10, scale: 2 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// User scheme mapping table
const userSchemes = pgTable('user_schemes', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    schemeId: integer('scheme_id').references(() => schemes.id).notNull(),
    status: varchar('status', { length: 20 }).default('ACTIVE'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

module.exports = {
    db,
    schemes,
    schemeCharges,
    userSchemes
};