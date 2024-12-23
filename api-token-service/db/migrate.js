// api-service/db/migrate.js
const { sql } = require('drizzle-orm');
const { db } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('API-Token-Migration');

async function migrate() {
    try {
        log.info('Starting API token service migrations...');
        
        // Execute migrations as raw SQL
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "api_tokens" (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                ip_addresses TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'PENDING',
                last_used_at TIMESTAMP,
                expires_at TIMESTAMP,
                rejection_reason TEXT,
                approved_by INTEGER,
                approved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (approved_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS "api_token_logs" (
                id SERIAL PRIMARY KEY,
                token_id INTEGER NOT NULL,
                ip_address VARCHAR(45) NOT NULL,
                user_agent TEXT,
                endpoint VARCHAR(255) NOT NULL,
                status VARCHAR(20) NOT NULL,
                failure_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (token_id) REFERENCES api_tokens(id)
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
            CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);
            CREATE INDEX IF NOT EXISTS idx_api_tokens_status ON api_tokens(status);
            CREATE INDEX IF NOT EXISTS idx_api_tokens_expires ON api_tokens(expires_at);
            CREATE INDEX IF NOT EXISTS idx_api_tokens_last_used ON api_tokens(last_used_at);
            CREATE INDEX IF NOT EXISTS idx_api_tokens_approved_by ON api_tokens(approved_by);

            CREATE INDEX IF NOT EXISTS idx_api_token_logs_token ON api_token_logs(token_id);
            CREATE INDEX IF NOT EXISTS idx_api_token_logs_ip ON api_token_logs(ip_address);
            CREATE INDEX IF NOT EXISTS idx_api_token_logs_status ON api_token_logs(status);
            CREATE INDEX IF NOT EXISTS idx_api_token_logs_created ON api_token_logs(created_at);
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

            DROP TRIGGER IF EXISTS update_api_tokens_timestamp ON api_tokens;
            CREATE TRIGGER update_api_tokens_timestamp
                BEFORE UPDATE ON api_tokens
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
        `);

        log.info('API token service migrations completed successfully');
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
