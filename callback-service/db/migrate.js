// callback-service/db/migrate.js
const { sql } = require('drizzle-orm');
const { db } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('Callback-Service-Migration');

async function migrate() {
    try {
        log.info('Starting callback service migrations...');
        
        // Execute migrations as raw SQL
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "callback_configs" (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name VARCHAR(100) NOT NULL,
                callback_url VARCHAR(255) NOT NULL,
                secret_key VARCHAR(255) NOT NULL,
                status VARCHAR(20) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS "callback_logs" (
                id SERIAL PRIMARY KEY,
                config_id INTEGER NOT NULL,
                original_request_data JSONB,
                decrypted_data JSONB,
                encrypted_response_data JSONB,
                status VARCHAR(20) NOT NULL,
                error_message TEXT,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (config_id) REFERENCES callback_configs(id)
            );

            CREATE TABLE IF NOT EXISTS "system_callback_logs" (
                id SERIAL PRIMARY KEY,
                encrypted_data TEXT NOT NULL,
                decrypted_data JSONB,
                payin_transaction_id INTEGER,
                status VARCHAR(20) DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (payin_transaction_id) REFERENCES payin_transactions(id)
            );

            CREATE TABLE IF NOT EXISTS "user_callback_logs" (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                config_id INTEGER NOT NULL,
                original_payload JSONB,
                modified_payload JSONB,
                status VARCHAR(20) DEFAULT 'PENDING',
                is_successful BOOLEAN DEFAULT false,
                error_message TEXT,
                callback_url VARCHAR(255),
                callback_response TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (config_id) REFERENCES callback_configs(id)
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_callback_configs_user ON callback_configs(user_id);
            CREATE INDEX IF NOT EXISTS idx_callback_configs_status ON callback_configs(status);

            CREATE INDEX IF NOT EXISTS idx_callback_logs_config ON callback_logs(config_id);
            CREATE INDEX IF NOT EXISTS idx_callback_logs_status ON callback_logs(status);
            CREATE INDEX IF NOT EXISTS idx_callback_logs_ip ON callback_logs(ip_address);

            CREATE INDEX IF NOT EXISTS idx_system_logs_status ON system_callback_logs(status);
            CREATE INDEX IF NOT EXISTS idx_system_logs_transaction ON system_callback_logs(payin_transaction_id);

            CREATE INDEX IF NOT EXISTS idx_user_logs_user ON user_callback_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_logs_config ON user_callback_logs(config_id);
            CREATE INDEX IF NOT EXISTS idx_user_logs_status ON user_callback_logs(status);
            CREATE INDEX IF NOT EXISTS idx_user_logs_success ON user_callback_logs(is_successful);
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

            DROP TRIGGER IF EXISTS update_callback_configs_timestamp ON callback_configs;
            CREATE TRIGGER update_callback_configs_timestamp
                BEFORE UPDATE ON callback_configs
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
        `);

        log.info('Callback service migrations completed successfully');
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
