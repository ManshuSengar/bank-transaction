// banking-service/db/migrate.js
const { sql } = require('drizzle-orm');
const { db } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('Banking-Service-Migration');

async function migrate() {
    try {
        log.info('Starting banking service migrations...');
        
        // Execute migrations as raw SQL
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "banks" (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                account_number VARCHAR(50) NOT NULL UNIQUE,
                ifsc VARCHAR(20) NOT NULL,
                branch VARCHAR(100) NOT NULL,
                security_pin VARCHAR(100),
                status VARCHAR(20) DEFAULT 'ACTIVE',
                balance DECIMAL(15,2) DEFAULT '0',
                min_balance DECIMAL(15,2) DEFAULT '0',
                max_balance DECIMAL(15,2),
                daily_limit DECIMAL(15,2),
                monthly_limit DECIMAL(15,2),
                last_transaction_at TIMESTAMP,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS "bank_transactions" (
                id SERIAL PRIMARY KEY,
                bank_id INTEGER NOT NULL,
                type VARCHAR(20) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                reference VARCHAR(100),
                description TEXT,
                balance_before DECIMAL(15,2) NOT NULL,
                balance_after DECIMAL(15,2) NOT NULL,
                status VARCHAR(20) NOT NULL,
                failure_reason TEXT,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (bank_id) REFERENCES banks(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS "bank_operation_logs" (
                id SERIAL PRIMARY KEY,
                bank_id INTEGER NOT NULL,
                operation VARCHAR(50) NOT NULL,
                status VARCHAR(20) NOT NULL,
                details TEXT,
                ip_address VARCHAR(50),
                user_agent TEXT,
                performed_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (bank_id) REFERENCES banks(id),
                FOREIGN KEY (performed_by) REFERENCES users(id)
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_banks_account ON banks(account_number);
            CREATE INDEX IF NOT EXISTS idx_banks_ifsc ON banks(ifsc);
            CREATE INDEX IF NOT EXISTS idx_banks_status ON banks(status);
            CREATE INDEX IF NOT EXISTS idx_banks_created_by ON banks(created_by);
            CREATE INDEX IF NOT EXISTS idx_banks_last_transaction ON banks(last_transaction_at);

            CREATE INDEX IF NOT EXISTS idx_transactions_bank ON bank_transactions(bank_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_type ON bank_transactions(type);
            CREATE INDEX IF NOT EXISTS idx_transactions_status ON bank_transactions(status);
            CREATE INDEX IF NOT EXISTS idx_transactions_created ON bank_transactions(created_at);
            CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON bank_transactions(created_by);

            CREATE INDEX IF NOT EXISTS idx_operation_logs_bank ON bank_operation_logs(bank_id);
            CREATE INDEX IF NOT EXISTS idx_operation_logs_operation ON bank_operation_logs(operation);
            CREATE INDEX IF NOT EXISTS idx_operation_logs_status ON bank_operation_logs(status);
            CREATE INDEX IF NOT EXISTS idx_operation_logs_performed_by ON bank_operation_logs(performed_by);
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

            DROP TRIGGER IF EXISTS update_banks_timestamp ON banks;
            CREATE TRIGGER update_banks_timestamp
                BEFORE UPDATE ON banks
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();

            DROP TRIGGER IF EXISTS update_bank_transactions_timestamp ON bank_transactions;
            CREATE TRIGGER update_bank_transactions_timestamp
                BEFORE UPDATE ON bank_transactions
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
        `);

        log.info('Banking service migrations completed successfully');
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
