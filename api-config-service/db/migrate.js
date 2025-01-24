// api-service/db/migrate.js
const { sql } = require('drizzle-orm');
const { db } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('API-Service-Migration');

async function migrate() {
    try {
        log.info('Starting API service migrations...');
        
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

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_api_configs_product ON api_configs(product_id);
            CREATE INDEX IF NOT EXISTS idx_api_configs_name ON api_configs(name);
            CREATE INDEX IF NOT EXISTS idx_api_configs_status ON api_configs(status);
            CREATE INDEX IF NOT EXISTS idx_api_configs_priority ON api_configs(priority);
            CREATE INDEX IF NOT EXISTS idx_api_configs_created_by ON api_configs(created_by);
            CREATE INDEX IF NOT EXISTS idx_api_configs_last_used ON api_configs(last_used_at);
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

            DROP TRIGGER IF EXISTS update_api_configs_timestamp ON api_configs;
            CREATE TRIGGER update_api_configs_timestamp
                BEFORE UPDATE ON api_configs
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
        `);

        log.info('API service migrations completed successfully');
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
