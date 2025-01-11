const { pgTable, serial, varchar, timestamp, decimal, integer, text, jsonb ,boolean} = require('drizzle-orm/pg-core');
const { drizzle } = require('drizzle-orm/node-postgres');
const { users } = require('../../user-service/db/schema');
const { schemes } = require('../../scheme-service/db/schema');
const { apiConfigs } = require('../../api-config-service/db/schema');
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

// Account Verifications Table
const accountVerifications = pgTable('account_verifications', {
    id: varchar('id', { length: 32 }).primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    accountNumber: varchar('account_number', { length: 50 }).notNull(),
    ifscCode: varchar('ifsc_code', { length: 20 }).notNull(),
    beneficiaryName: varchar('beneficiary_name', { length: 100 }),
    phoneNumber: varchar('phone_number', { length: 15 }),
    clientOrderId: varchar('client_order_id', { length: 100 }).notNull().unique(),
    orderId: varchar('order_id', { length: 100 }),
    status: varchar('status', { length: 20 }).notNull(), // PENDING, VERIFIED, FAILED
    vendorResponse: jsonb('vendor_response'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Payout Transactions Table
const payoutTransactions = pgTable('payout_transactions', {
    id: varchar('id', { length: 32 }).primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    schemeId: integer('scheme_id').references(() => schemes.id).notNull(),
    apiConfigId: integer('api_config_id').references(() => apiConfigs.id).notNull(),
    clientOrderId: varchar('client_order_id', { length: 100 }).notNull().unique(),
    vendorOrderId: varchar('vendor_order_id', { length: 32 }).notNull().unique(), // Our reference used with vendor
    orderId: varchar('order_id', { length: 100 }),
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    transferMode: varchar('transfer_mode', { length: 20 }).notNull(), // IMPS, NEFT, RTGS
    accountNumber: varchar('account_number', { length: 50 }).notNull(),
    ifscCode: varchar('ifsc_code', { length: 20 }).notNull(),
    beneficiaryName: varchar('beneficiary_name', { length: 100 }),
    phoneNumber: varchar('phone_number', { length: 15 }),
    vpa: varchar('vpa', { length: 100 }),
    baseAmount: decimal('base_amount', { precision: 15, scale: 2 }).notNull(),
    chargeType: varchar('charge_type', { length: 20 }).notNull(),
    chargeValue: decimal('charge_value', { precision: 10, scale: 2 }).notNull(),
    gstPercentage: decimal('gst_percentage', { precision: 5, scale: 2 }),
    gstAmount: decimal('gst_amount', { precision: 10, scale: 2 }),
    totalCharges: decimal('total_charges', { precision: 15, scale: 2 }).notNull(),
    status: varchar('status', { length: 20 }).default('PENDING'),
    errorMessage: text('error_message'),
    utrNumber: varchar('utr_number', { length: 100 }),
    vendorResponse: jsonb('vendor_response'),
    vendorTransactionId: varchar('vendor_transaction_id', { length: 100 }),
    processedAt: timestamp('processed_at'),
    lockId: varchar('lock_id', { length: 100 }),
    lockExpiry: timestamp('lock_expiry'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    completedAt: timestamp('completed_at')
});

const systemCallbackLogs = pgTable('payout_system_callback_logs', {
    id: serial('id').primaryKey(),
    encryptedData: text('encrypted_data').notNull(),
    decryptedData: jsonb('decrypted_data'),
    payoutTransactionId: varchar('payout_transaction_id', { length: 32 })
    .references(() => payoutTransactions.id),
    status: varchar('status', { length: 20 }).default('PENDING'),
    createdAt: timestamp('created_at').defaultNow()
});

const userCallbackLogs = pgTable('payout_user_callback_logs', {
    id: serial('id').primaryKey(),
    transactionId: varchar('transaction_id', { length: 100 }).notNull(),
    userId: integer('user_id').references(() => users.id).notNull(),
    configId: integer('config_id').references(() => apiConfigs.id).notNull(),
    originalPayload: jsonb('original_payload'),
    modifiedPayload: jsonb('modified_payload'),
    status: varchar('status', { length: 20 }).default('PENDING'),
    isSuccessful: boolean('is_successful').default(false),
    errorMessage: text('error_message'),
    callbackUrl: varchar('callback_url', { length: 255 }),
    callbackResponse: text('callback_response'),
    createdAt: timestamp('created_at').defaultNow()
});

module.exports = {
    db,
    accountVerifications,
    payoutTransactions,
    systemCallbackLogs,
    userCallbackLogs
};