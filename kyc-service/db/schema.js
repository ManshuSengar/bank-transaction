const { pgTable, serial, varchar, timestamp, text, integer, boolean } = require('drizzle-orm/pg-core');
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

// Create drizzle database instance
const db = drizzle(pool, { logger: true });

// Aadhar verification table
const aadharVerifications = pgTable('aadhar_verifications', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    aadharNumber: varchar('aadhar_number', { length: 12 }).notNull().unique(),
    fullName: varchar('full_name', { length: 100 }).notNull(),
    dateOfBirth: timestamp('date_of_birth').notNull(),
    gender: varchar('gender', { length: 10 }).notNull(),
    address: text('address').notNull(),
    documentImagePath: varchar('document_image_path', { length: 255 }).notNull(),
    isVerified: boolean('is_verified').default(false),
    verificationStatus: varchar('verification_status', { length: 20 }).default('PENDING'),
    verificationComments: text('verification_comments'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    verifiedAt: timestamp('verified_at')
});

// PAN verification table
const panVerifications = pgTable('pan_verifications', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    panNumber: varchar('pan_number', { length: 10 }).notNull().unique(),
    fullName: varchar('full_name', { length: 100 }).notNull(),
    dateOfBirth: timestamp('date_of_birth').notNull(),
    documentImagePath: varchar('document_image_path', { length: 255 }).notNull(),
    isVerified: boolean('is_verified').default(false),
    verificationStatus: varchar('verification_status', { length: 20 }).default('PENDING'),
    verificationComments: text('verification_comments'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    verifiedAt: timestamp('verified_at')
});

module.exports = {
    db,
    aadharVerifications,
    panVerifications
};