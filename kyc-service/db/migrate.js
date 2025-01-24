const { sql } = require('drizzle-orm');
const { db } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('Verification-Service-Migration');

async function migrate() {
    try {
        log.info('Starting verification service migrations...');
        
        // Execute migrations as raw SQL
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "aadhar_verifications" (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
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
                verified_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS "pan_verifications" (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                pan_number VARCHAR(10) NOT NULL UNIQUE,
                full_name VARCHAR(100) NOT NULL,
                date_of_birth TIMESTAMP NOT NULL,
                document_image_path VARCHAR(255) NOT NULL,
                is_verified BOOLEAN DEFAULT false,
                verification_status VARCHAR(20) DEFAULT 'PENDING',
                verification_comments TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                verified_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_aadhar_user ON aadhar_verifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_aadhar_number ON aadhar_verifications(aadhar_number);
            CREATE INDEX IF NOT EXISTS idx_aadhar_status ON aadhar_verifications(verification_status);
            CREATE INDEX IF NOT EXISTS idx_aadhar_verified ON aadhar_verifications(is_verified);
            CREATE INDEX IF NOT EXISTS idx_aadhar_verified_at ON aadhar_verifications(verified_at);

            CREATE INDEX IF NOT EXISTS idx_pan_user ON pan_verifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_pan_number ON pan_verifications(pan_number);
            CREATE INDEX IF NOT EXISTS idx_pan_status ON pan_verifications(verification_status);
            CREATE INDEX IF NOT EXISTS idx_pan_verified ON pan_verifications(is_verified);
            CREATE INDEX IF NOT EXISTS idx_pan_verified_at ON pan_verifications(verified_at);
        `);

        // Add trigger for updated_at timestamp
        await db.execute(sql`
            CREATE OR REPLACE FUNCTION update_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';

            DROP TRIGGER IF EXISTS update_aadhar_timestamp ON aadhar_verifications;
            CREATE TRIGGER update_aadhar_timestamp
                BEFORE UPDATE ON aadhar_verifications
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();

            DROP TRIGGER IF EXISTS update_pan_timestamp ON pan_verifications;
            CREATE TRIGGER update_pan_timestamp
                BEFORE UPDATE ON pan_verifications
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
        `);

        log.info('Verification service migrations completed successfully');
    } catch (error) {
        log.error('Error during migration:', error);
        throw error;
    }
}

// Run migrations if script is executed directly
if (require.main === module) {
    migrate()
        .then(() => {
            console.log('Migrations completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { migrate };
