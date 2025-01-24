// fund-service/db/migrate.js
const { sql } = require('drizzle-orm');
const { db } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('Fund-Service-Migration');

async function migrate() {
    try {
        log.info('Starting fund service migrations...');
        
        // Execute migrations as raw SQL
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "fund_requests" (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                bank_id INTEGER NOT NULL,
                wallet_type VARCHAR(20) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                payment_mode VARCHAR(50) NOT NULL,
                payment_date TIMESTAMP NOT NULL,
                reference_number VARCHAR(100) NOT NULL,
                document_path VARCHAR(255),
                remarks TEXT,
                status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
                approved_by INTEGER,
                approved_at TIMESTAMP,
                rejection_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (bank_id) REFERENCES banks(id),
                FOREIGN KEY (approved_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS "fund_request_logs" (
                id SERIAL PRIMARY KEY,
                request_id INTEGER NOT NULL,
                action VARCHAR(50) NOT NULL,
                old_status VARCHAR(20),
                new_status VARCHAR(20),
                performed_by INTEGER NOT NULL,
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES fund_requests(id),
                FOREIGN KEY (performed_by) REFERENCES users(id)
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_fund_requests_user ON fund_requests(user_id);
            CREATE INDEX IF NOT EXISTS idx_fund_requests_bank ON fund_requests(bank_id);
            CREATE INDEX IF NOT EXISTS idx_fund_requests_status ON fund_requests(status);
            CREATE INDEX IF NOT EXISTS idx_fund_requests_wallet ON fund_requests(wallet_type);
            CREATE INDEX IF NOT EXISTS idx_fund_requests_approved_by ON fund_requests(approved_by);
            CREATE INDEX IF NOT EXISTS idx_fund_requests_payment_date ON fund_requests(payment_date);
            CREATE INDEX IF NOT EXISTS idx_fund_requests_reference ON fund_requests(reference_number);

            CREATE INDEX IF NOT EXISTS idx_fund_request_logs_request ON fund_request_logs(request_id);
            CREATE INDEX IF NOT EXISTS idx_fund_request_logs_action ON fund_request_logs(action);
            CREATE INDEX IF NOT EXISTS idx_fund_request_logs_performed_by ON fund_request_logs(performed_by);
            CREATE INDEX IF NOT EXISTS idx_fund_request_logs_created ON fund_request_logs(created_at);
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

            DROP TRIGGER IF EXISTS update_fund_requests_timestamp ON fund_requests;
            CREATE TRIGGER update_fund_requests_timestamp
                BEFORE UPDATE ON fund_requests
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
        `);

        log.info('Fund service migrations completed successfully');
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
