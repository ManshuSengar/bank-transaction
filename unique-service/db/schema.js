// unique-service/db/schema.js
const { pgTable, serial, varchar, timestamp, integer, unique, decimal } = require('drizzle-orm/pg-core');
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

// Unique ID Tracking Table
const uniqueIdTracking = pgTable('unique_id_tracking', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    originalUniqueId: varchar('original_unique_id', { length: 100 }).notNull(),
    generatedUniqueId: varchar('generated_unique_id', { length: 100 }).notNull().unique(),
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(), // Add amount column
    status: varchar('status', { length: 20 }).default('ACTIVE'), // ACTIVE, USED, EXPIRED
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
}, (table) => {
    return { 
        unqUserOriginalId: unique('unq_user_original_id').on(table.userId, table.originalUniqueId)
    };
});

module.exports = {
    db,
    uniqueIdTracking
};