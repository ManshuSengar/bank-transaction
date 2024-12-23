// wallet-service/db/schema.js
const { pgTable, serial, varchar, timestamp, decimal, integer, text ,jsonb} = require('drizzle-orm/pg-core');
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

// Wallet types table
const walletTypes = pgTable('wallet_types', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 50 }).notNull().unique(), // SERVICE, COLLECTION, PAYOUT
    description: text('description'),
    minBalance: decimal('min_balance', { precision: 15, scale: 2 }).default('0'),
    maxBalance: decimal('max_balance', { precision: 15, scale: 2 }),
    dailyLimit: decimal('daily_limit', { precision: 15, scale: 2 }),
    monthlyLimit: decimal('monthly_limit', { precision: 15, scale: 2 }),
    status: varchar('status', { length: 20 }).default('ACTIVE'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// User wallets table
const userWallets = pgTable('user_wallets', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    walletTypeId: integer('wallet_type_id').references(() => walletTypes.id).notNull(),
    balance: decimal('balance', { precision: 15, scale: 2 }).default('0'),
    status: varchar('status', { length: 20 }).default('ACTIVE'),
    lastTransactionAt: timestamp('last_transaction_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Wallet transactions table
const walletTransactions = pgTable('wallet_transactions', {
    id: serial('id').primaryKey(),
    fromWalletId: integer('from_wallet_id').references(() => userWallets.id),
    toWalletId: integer('to_wallet_id').references(() => userWallets.id),
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // CREDIT, DEBIT, TRANSFER
    description: text('description'),
    reference: varchar('reference', { length: 100 }),
    status: varchar('status', { length: 20 }).default('PENDING'),
    balanceBefore: decimal('balance_before', { precision: 15, scale: 2 }).notNull(),
    balanceAfter: decimal('balance_after', { precision: 15, scale: 2 }).notNull(),
    metadata: text('metadata'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    completedAt: timestamp('completed_at')
});

const walletTransactionLogs = pgTable('wallet_transaction_logs', {
    id: serial('id').primaryKey(),
    walletId: integer('wallet_id').references(() => userWallets.id).notNull(),
    transactionId: integer('transaction_id').references(() => walletTransactions.id).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // CREDIT, DEBIT
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    balanceBefore: decimal('balance_before', { precision: 15, scale: 2 }).notNull(),
    balanceAfter: decimal('balance_after', { precision: 15, scale: 2 }).notNull(),
    description: text('description'),
    referenceType: varchar('reference_type', { length: 50 }), // PAYIN, PAYOUT, FUND_REQUEST, etc.
    referenceId: varchar('reference_id', { length: 100 }),
    userId: integer('user_id').references(() => users.id).notNull(),
    status: varchar('status', { length: 20 }).notNull(), // SUCCESS, FAILED
    additionalMetadata: jsonb('additional_metadata'),
    createdAt: timestamp('created_at').defaultNow()
});
module.exports = {
    db,
    walletTypes,
    userWallets,
    walletTransactions,
    walletTransactionLogs
};