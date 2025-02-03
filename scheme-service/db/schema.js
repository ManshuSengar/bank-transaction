// scheme-service/db/schema.js
const { pgTable, serial, varchar, timestamp, text, integer, decimal, boolean } = require('drizzle-orm/pg-core');
const { drizzle } = require('drizzle-orm/node-postgres');
const { users } = require('../../user-service/db/schema');
const { products } = require('../../product-service/db/schema');
const config = require('config');
const { Pool } = require('pg');

const pool = new Pool({
    host: config.get('postgres-config.host'),
    port: config.get('postgres-config.port'),
    user: config.get('postgres-config.user'),
    password: config.get('postgres-config.password'),
    database: config.get('postgres-config.database')
});

const db = drizzle(pool);

const apiConfigs = pgTable('api_configs', {
    id: serial('id').primaryKey(),
    productId: integer('product_id').references(() => products.id).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    baseUrl: varchar('base_url', { length: 255 }).notNull(),
    username: varchar('username', { length: 100 }),
    password: varchar('password', { length: 255 }),
    apiKey: varchar('api_key', { length: 255 }),
    secretKey: varchar('secret_key', { length: 255 }),
    ipWhitelist: text('ip_whitelist'),
    status: varchar('status', { length: 20 }).default('ACTIVE'),
    priority: integer('priority').default(0),
    isDefault: boolean('is_default').default(false),
    expiresAt: timestamp('expires_at'),
    lastUsedAt: timestamp('last_used_at'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Schemes table with product association
const schemes = pgTable('schemes', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    productId: integer('product_id').references(() => products.id).notNull(),
    status: varchar('status', { length: 20 }).default('ACTIVE'),
    description: text('description'),
    minTransactionLimit: decimal('min_transaction_limit', { precision: 15, scale: 2 }),
    maxTransactionLimit: decimal('max_transaction_limit', { precision: 15, scale: 2 }),
    dailyLimit: decimal('daily_limit', { precision: 15, scale: 2 }),
    monthlyLimit: decimal('monthly_limit', { precision: 15, scale: 2 }),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Scheme Charges with API mapping
const schemeCharges = pgTable('scheme_charges', {
    id: serial('id').primaryKey(),
    schemeId: integer('scheme_id').references(() => schemes.id).notNull(),
    apiConfigId: integer('api_config_id').references(() => apiConfigs.id),
    minAmount: decimal('min_amount', { precision: 10, scale: 2 }),
    maxAmount: decimal('max_amount', { precision: 10, scale: 2 }),
    chargeType: varchar('charge_type', { length: 20 }).notNull(), // FLAT, PERCENTAGE
    chargeValue: decimal('charge_value', { precision: 10, scale: 2 }).notNull(),
    gst: decimal('gst', { precision: 5, scale: 2 }),
    tds: decimal('tds', { precision: 5, scale: 2 }),
    status: varchar('status', { length: 20 }).default('ACTIVE'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// User scheme assignments
const userSchemes = pgTable('user_schemes', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    schemeId: integer('scheme_id').references(() => schemes.id).notNull(),
    status: varchar('status', { length: 20 }).default('ACTIVE'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Scheme transaction logs
const schemeTransactionLogs = pgTable('scheme_transaction_logs', {
    id: serial('id').primaryKey(),
    schemeId: integer('scheme_id').references(() => schemes.id).notNull(),
    userId: integer('user_id').references(() => users.id).notNull(),
    apiConfigId: integer('api_config_id').references(() => apiConfigs.id),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    charges: decimal('charges', { precision: 10, scale: 2 }).notNull(),
    gst: decimal('gst', { precision: 10, scale: 2 }),
    tds: decimal('tds', { precision: 10, scale: 2 }),
    status: varchar('status', { length: 20 }).notNull(),
    transactionId: varchar('transaction_id', { length: 100 }),
    referenceId: varchar('reference_id', { length: 100 }),
    remarks: text('remarks'),
    createdAt: timestamp('created_at').defaultNow()
});

module.exports = {
    db,
    apiConfigs,
    schemes,
    schemeCharges,
    userSchemes,
    schemeTransactionLogs
};

