const { pgTable, serial, varchar, timestamp, text, integer, decimal, boolean } = require('drizzle-orm/pg-core');
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

const banks = pgTable('banks', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    accountNumber: varchar('account_number', { length: 50 }).notNull().unique(),
    ifsc: varchar('ifsc', { length: 20 }).notNull(),
    branch: varchar('branch', { length: 100 }).notNull(),
    securityPin: varchar('security_pin', { length: 100 }),
    status: varchar('status', { length: 20 }).default('ACTIVE'),
    balance: decimal('balance', { precision: 15, scale: 2 }).default('0'),
    minBalance: decimal('min_balance', { precision: 15, scale: 2 }).default('0'),
    maxBalance: decimal('max_balance', { precision: 15, scale: 2 }),
    dailyLimit: decimal('daily_limit', { precision: 15, scale: 2 }),
    monthlyLimit: decimal('monthly_limit', { precision: 15, scale: 2 }),
    lastTransactionAt: timestamp('last_transaction_at'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

const bankTransactions = pgTable('bank_transactions', {
    id: serial('id').primaryKey(),
    bankId: integer('bank_id').references(() => banks.id).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // CREDIT, DEBIT
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    reference: varchar('reference', { length: 100 }),
    description: text('description'),
    balanceBefore: decimal('balance_before', { precision: 15, scale: 2 }).notNull(),
    balanceAfter: decimal('balance_after', { precision: 15, scale: 2 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(), // SUCCESS, FAILED, PENDING
    failureReason: text('failure_reason'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

const bankOperationLogs = pgTable('bank_operation_logs', {
    id: serial('id').primaryKey(),
    bankId: integer('bank_id').references(() => banks.id).notNull(),
    operation: varchar('operation', { length: 50 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    details: text('details'),
    ipAddress: varchar('ip_address', { length: 50 }),
    userAgent: text('user_agent'),
    performedBy: integer('performed_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow()
});

module.exports = {
    db,
    banks,
    bankTransactions,
    bankOperationLogs
};
