// payin-service/db/migrate.js
const { sql } = require('drizzle-orm');
const { db } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('Payin-Service-Migration');

async function migrate() {
    try {
        log.info('Starting payin service migrations...');
        
        // Execute migrations as raw SQL
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "payin_transactions" (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                scheme_id INTEGER NOT NULL,
                api_config_id INTEGER NOT NULL,
                
                -- Transaction Details
                amount DECIMAL(15,2) NOT NULL,
                unique_id VARCHAR(100) NOT NULL,
                qr_string TEXT,
                
                -- Charges Breakdown
                base_amount DECIMAL(15,2) NOT NULL,
                charge_type VARCHAR(20) NOT NULL,
                charge_value DECIMAL(10,2) NOT NULL,
                gst_percentage DECIMAL(5,2),
                gst_amount DECIMAL(10,2),
                total_charges DECIMAL(15,2) NOT NULL,
                
                -- Transaction Status
                status VARCHAR(20) DEFAULT 'PENDING',
                error_message TEXT,
                
                -- Vendor-specific details
                vendor_transaction_id VARCHAR(100),
                vendor_response JSONB,
                
                -- Audit Fields
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                -- Foreign Keys
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (scheme_id) REFERENCES schemes(id),
                FOREIGN KEY (api_config_id) REFERENCES api_configs(id)
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_payin_user ON payin_transactions(user_id);
            CREATE INDEX IF NOT EXISTS idx_payin_scheme ON payin_transactions(scheme_id);
            CREATE INDEX IF NOT EXISTS idx_payin_api_config ON payin_transactions(api_config_id);
            CREATE INDEX IF NOT EXISTS idx_payin_unique_id ON payin_transactions(unique_id);
            CREATE INDEX IF NOT EXISTS idx_payin_status ON payin_transactions(status);
            CREATE INDEX IF NOT EXISTS idx_payin_vendor_txn ON payin_transactions(vendor_transaction_id);
            CREATE INDEX IF NOT EXISTS idx_payin_created ON payin_transactions(created_at);
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

            DROP TRIGGER IF EXISTS update_payin_transactions_timestamp ON payin_transactions;
            CREATE TRIGGER update_payin_transactions_timestamp
                BEFORE UPDATE ON payin_transactions
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
        `);

        log.info('Payin service migrations completed successfully');
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
