const { pgTable, serial, varchar, timestamp, text, integer, boolean } = require('drizzle-orm/pg-core');
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

const apiTokens = pgTable('api_tokens', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    ipAddresses: text('ip_addresses').notNull(), // Comma-separated list of IPs
    status: varchar('status', { length: 20 }).default('PENDING'), // PENDING, ACTIVE, INACTIVE, REJECTED
    lastUsedAt: timestamp('last_used_at'),
    expiresAt: timestamp('expires_at'),
    rejectionReason: text('rejection_reason'),
    approvedBy: integer('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Token Usage Logs
const apiTokenLogs = pgTable('api_token_logs', {
    id: serial('id').primaryKey(),
    tokenId: integer('token_id').references(() => apiTokens.id).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    userAgent: text('user_agent'),
    endpoint: varchar('endpoint', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(), // SUCCESS, FAILED
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at').defaultNow()
});

module.exports = {
    db,
    apiTokens,
    apiTokenLogs
};
