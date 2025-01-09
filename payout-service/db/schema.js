// payout-service/db/schema.js
const { pgTable, serial, varchar, timestamp, decimal, integer, text, jsonb } = require('drizzle-orm/pg-core');
const { drizzle } = require('drizzle-orm/node-postgres');
const { users } = require('../../user-service/db/schema');
const { schemes } = require('../../scheme-service/db/schema');
const { apiConfigs } = require('../../scheme-service/db/schema');
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

// payout Transactions Table
const payoutTransactions = pgTable('payout_transactions', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    schemeId: integer('scheme_id').references(() => schemes.id).notNull(),
    apiConfigId: integer('api_config_id').references(() => apiConfigs.id).notNull(),
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    uniqueId: varchar('unique_id', { length: 100 }).notNull(), // External transaction reference
    transactionId: varchar('transaction_id', { length: 2000 }).notNull(),
    utrString: text('utr_string'),
    baseAmount: decimal('base_amount', { precision: 15, scale: 2 }).notNull(),
    chargeType: varchar('charge_type', { length: 20 }).notNull(), // FLAT or PERCENTAGE
    chargeValue: decimal('charge_value', { precision: 10, scale: 2 }).notNull(),
    gstPercentage: decimal('gst_percentage', { precision: 5, scale: 2 }),
    gstAmount: decimal('gst_amount', { precision: 10, scale: 2 }),
    totalCharges: decimal('total_charges', { precision: 15, scale: 2 }).notNull(),
    status: varchar('status', { length: 20 }).default('PENDING'), // PENDING, SUCCESS, FAILED
    errorMessage: text('error_message'),
    vendorTransactionId: varchar('vendor_transaction_id', { length: 100}),
    vendorResponse: jsonb('vendor_response'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

module.exports = {
    db,
    payoutTransactions
};