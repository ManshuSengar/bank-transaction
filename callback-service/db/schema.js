const { pgTable, serial, varchar, timestamp, boolean,text, integer, jsonb } = require('drizzle-orm/pg-core');
const { drizzle } = require('drizzle-orm/node-postgres');
const { users } = require('../../user-service/db/schema');
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

// Callback configuration table
const callbackConfigs = pgTable('callback_configs', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    callbackUrl: varchar('callback_url', { length: 255 }).notNull(),
    secretKey: varchar('secret_key', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).default('ACTIVE'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Callback transaction logs
const callbackLogs = pgTable('callback_logs', {
    id: serial('id').primaryKey(),
    configId: integer('config_id').references(() => callbackConfigs.id).notNull(),
    originalRequestData: jsonb('original_request_data'),
    decryptedData: jsonb('decrypted_data'),
    encryptedResponseData: jsonb('encrypted_response_data'),
    status: varchar('status', { length: 20 }).notNull(), // SUCCESS, FAILED, PENDING
    errorMessage: text('error_message'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow()
});


const systemCallbackLogs = pgTable('system_callback_logs', {
    id: serial('id').primaryKey(),
    encryptedData: text('encrypted_data').notNull(),
    decryptedData: jsonb('decrypted_data'),
    payinTransactionId: integer('payin_transaction_id').references(() => payinTransactions.id),
    status: varchar('status', { length: 20 }).default('PENDING'),
    createdAt: timestamp('created_at').defaultNow()
});

const userCallbackLogs = pgTable('user_callback_logs', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    configId: integer('config_id').references(() => callbackConfigs.id).notNull(),
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
    callbackConfigs,
    callbackLogs,userCallbackLogs,systemCallbackLogs
};