// kyc-service/db/migrate.js
const { sql } = require('drizzle-orm');
const { db } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('KYC-Service-Migration');

async function migrate() {
    try {
        log.info('Starting KYC service migrations...');
        
        // Execute migrations
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS aadhar_verifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                aadhar_number VARCHAR(12) NOT NULL UNIQUE,
                full_name VARCHAR(100) NOT NULL,
                date_of_birth TIMESTAMP NOT NULL,
                gender VARCHAR(10) NOT NULL,
                address TEXT NOT NULL,
                document_image_path VARCHAR(255) NOT NULL,
                is_verified BOOLEAN DEFAULT false,
                verification_status VARCHAR(20) DEFAULT 'PENDING',
                verification_comments TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                verified_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS pan_verifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                pan_number VARCHAR(10) NOT NULL UNIQUE,
                full_name VARCHAR(100) NOT NULL,
                date_of_birth TIMESTAMP NOT NULL,
                document_image_path VARCHAR(255) NOT NULL,
                is_verified BOOLEAN DEFAULT false,
                verification_status VARCHAR(20) DEFAULT 'PENDING',
                verification_comments TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                verified_at TIMESTAMP
            );
        `);

        // Create indexes
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_aadhar_user ON aadhar_verifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_aadhar_status ON aadhar_verifications(verification_status);
            CREATE INDEX IF NOT EXISTS idx_aadhar_number ON aadhar_verifications(aadhar_number);
            
            CREATE INDEX IF NOT EXISTS idx_pan_user ON pan_verifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_pan_status ON pan_verifications(verification_status);
            CREATE INDEX IF NOT EXISTS idx_pan_number ON pan_verifications(pan_number);
        `);

        log.info('KYC service migrations completed successfully');
    } catch (error) {
        log.error('Error during KYC migration:', error);
        throw error;
    }
}

// Run migrations if script is executed directly
if (require.main === module) {
    migrate()
        .then(() => {
            console.log('KYC migrations completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('KYC migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migrate };