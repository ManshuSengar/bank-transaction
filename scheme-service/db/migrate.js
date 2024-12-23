// scheme-service/db/migrate.js
const { sql } = require('drizzle-orm');
const { db } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('Scheme-Service-Migration');

async function migrate() {
    try {
        log.info('Starting scheme service migrations...');
        
        // Execute migrations as raw SQL
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "api_configs" (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL,
                name VARCHAR(100) NOT NULL,
                base_url VARCHAR(255) NOT NULL,
                username VARCHAR(100),
                password VARCHAR(255),
                api_key VARCHAR(255),
                secret_key VARCHAR(255),
                ip_whitelist TEXT,
                status VARCHAR(20) DEFAULT 'ACTIVE',
                priority INTEGER DEFAULT 0,
                is_default BOOLEAN DEFAULT false,
                expires_at TIMESTAMP,
                last_used_at TIMESTAMP,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS "schemes" (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                product_id INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'ACTIVE',
                description TEXT,
                min_transaction_limit DECIMAL(10,2),
                max_transaction_limit DECIMAL(10,2),
                daily_limit DECIMAL(10,2),
                monthly_limit DECIMAL(10,2),
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS "scheme_charges" (
                id SERIAL PRIMARY KEY,
                scheme_id INTEGER NOT NULL,
                api_config_id INTEGER,
                min_amount DECIMAL(10,2),
                max_amount DECIMAL(10,2),
                charge_type VARCHAR(20) NOT NULL,
                charge_value DECIMAL(10,2) NOT NULL,
                gst DECIMAL(5,2),
                tds DECIMAL(5,2),
                status VARCHAR(20) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (scheme_id) REFERENCES schemes(id),
                FOREIGN KEY (api_config_id) REFERENCES api_configs(id)
            );

            CREATE TABLE IF NOT EXISTS "user_schemes" (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                scheme_id INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'ACTIVE',
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (scheme_id) REFERENCES schemes(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS "scheme_transaction_logs" (
                id SERIAL PRIMARY KEY,
                scheme_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                api_config_id INTEGER,
                amount DECIMAL(10,2) NOT NULL,
                charges DECIMAL(10,2) NOT NULL,
                gst DECIMAL(10,2),
                tds DECIMAL(10,2),
                status VARCHAR(20) NOT NULL,
                transaction_id VARCHAR(100),
                reference_id VARCHAR(100),
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (scheme_id) REFERENCES schemes(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (api_config_id) REFERENCES api_configs(id)
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_api_configs_product ON api_configs(product_id);
            CREATE INDEX IF NOT EXISTS idx_api_configs_status ON api_configs(status);
            CREATE INDEX IF NOT EXISTS idx_api_configs_priority ON api_configs(priority);
            
            CREATE INDEX IF NOT EXISTS idx_schemes_product ON schemes(product_id);
            CREATE INDEX IF NOT EXISTS idx_schemes_status ON schemes(status);
            CREATE INDEX IF NOT EXISTS idx_schemes_name ON schemes(name);
            
            CREATE INDEX IF NOT EXISTS idx_scheme_charges_scheme ON scheme_charges(scheme_id);
            CREATE INDEX IF NOT EXISTS idx_scheme_charges_api ON scheme_charges(api_config_id);
            CREATE INDEX IF NOT EXISTS idx_scheme_charges_status ON scheme_charges(status);
            
            CREATE INDEX IF NOT EXISTS idx_user_schemes_user ON user_schemes(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_schemes_scheme ON user_schemes(scheme_id);
            CREATE INDEX IF NOT EXISTS idx_user_schemes_status ON user_schemes(status);
            
            CREATE INDEX IF NOT EXISTS idx_transaction_logs_scheme ON scheme_transaction_logs(scheme_id);
            CREATE INDEX IF NOT EXISTS idx_transaction_logs_user ON scheme_transaction_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_transaction_logs_api ON scheme_transaction_logs(api_config_id);
            CREATE INDEX IF NOT EXISTS idx_transaction_logs_status ON scheme_transaction_logs(status);
        `);

        // Add triggers for updated_at timestamps
        await db.execute(sql`
            CREATE OR REPLACE FUNCTION update_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';

            DROP TRIGGER IF EXISTS update_api_configs_timestamp ON api_configs;
            CREATE TRIGGER update_api_configs_timestamp
                BEFORE UPDATE ON api_configs
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();

            DROP TRIGGER IF EXISTS update_schemes_timestamp ON schemes;
            CREATE TRIGGER update_schemes_timestamp
                BEFORE UPDATE ON schemes
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();

            DROP TRIGGER IF EXISTS update_scheme_charges_timestamp ON scheme_charges;
            CREATE TRIGGER update_scheme_charges_timestamp
                BEFORE UPDATE ON scheme_charges
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();

            DROP TRIGGER IF EXISTS update_user_schemes_timestamp ON user_schemes;
            CREATE TRIGGER update_user_schemes_timestamp
                BEFORE UPDATE ON user_schemes
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
        `);

        log.info('Scheme service migrations completed successfully');
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
