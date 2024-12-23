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

module.exports = {
    db,
    apiConfigs,
   
};
