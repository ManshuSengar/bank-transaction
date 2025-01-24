const { pgTable, serial, varchar, timestamp, decimal, integer, text } = require('drizzle-orm/pg-core');
const { drizzle } = require('drizzle-orm/node-postgres');
const { users } = require('../../user-service/db/schema');
const { banks } = require('../../bank-service/db/schema');
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

// Fund requests table
const fundRequests = pgTable('fund_requests', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    bankId: integer('bank_id').references(() => banks.id),
    walletType: varchar('wallet_type', { length: 20 }), // Target wallet type
    sourceWalletType: varchar('source_wallet_type', { length: 20 }), // For wallet to wallet transfer
    targetWalletType: varchar('target_wallet_type', { length: 20 }), // For wallet to wallet transfer
    transferType: varchar('transfer_type', { length: 20 }).notNull(), // BANK_TO_WALLET, WALLET_TO_WALLET
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    paymentMode: varchar('payment_mode', { length: 50 }), 
    
    paymentDate: timestamp('payment_date').notNull(),
    referenceNumber: varchar('reference_number', { length: 100 }).notNull(),
    documentPath: varchar('document_path', { length: 255 }), // For payment slip
    remarks: text('remarks'),
    
    status: varchar('status', { length: 20 }).default('PENDING').notNull(), 
    approvedBy: integer('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),
    rejectionReason: text('rejection_reason'),
    
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Fund request audit logs
const fundRequestLogs = pgTable('fund_request_logs', {
    id: serial('id').primaryKey(),
    requestId: integer('request_id').references(() => fundRequests.id).notNull(),
    action: varchar('action', { length: 50 }).notNull(), // CREATED, STATUS_UPDATED, etc.
    oldStatus: varchar('old_status', { length: 20 }),
    newStatus: varchar('new_status', { length: 20 }),
    performedBy: integer('performed_by').references(() => users.id).notNull(),
    remarks: text('remarks'),
    createdAt: timestamp('created_at').defaultNow()
});

module.exports = {
    db,
    fundRequests,
    fundRequestLogs
};