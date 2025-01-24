const { pgTable, serial, varchar, timestamp, boolean } = require('drizzle-orm/pg-core');
const { drizzle } = require('drizzle-orm/node-postgres');
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

// Products table - simplified
const products = pgTable('products', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

module.exports = {
    db,
    products
};