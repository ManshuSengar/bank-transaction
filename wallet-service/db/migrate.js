// wallet-service/db/migrations.js
const { sql } = require('drizzle-orm');
const { db } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('Wallet-Service-Migration');

async function migrate() {
    try {
        log.info('Starting wallet service migrations...');
        
        // Execute migrations as raw SQL
        await db.execute(sql`
            -- Create wallet_types table
            CREATE TABLE IF NOT EXISTS "wallet_types" (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL UNIQUE,
                description TEXT,
                min_balance DECIMAL(15,2) DEFAULT '0',
                max_balance DECIMAL(15,2),
                daily_limit DECIMAL(15,2),
                monthly_limit DECIMAL(15,2),
                status VARCHAR(20) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Create user_wallets table
            CREATE TABLE IF NOT EXISTS "user_wallets" (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                wallet_type_id INTEGER NOT NULL,
                balance DECIMAL(15,2) DEFAULT '0',
                status VARCHAR(20) DEFAULT 'ACTIVE',
                last_transaction_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (wallet_type_id) REFERENCES wallet_types(id)
            );

            -- Create wallet_transactions table
            CREATE TABLE IF NOT EXISTS "wallet_transactions" (
                id SERIAL PRIMARY KEY,
                from_wallet_id INTEGER,
                to_wallet_id INTEGER,
                amount DECIMAL(15,2) NOT NULL,
                type VARCHAR(50) NOT NULL,
                description TEXT,
                reference VARCHAR(100),
                status VARCHAR(20) DEFAULT 'PENDING',
                balance_before DECIMAL(15,2) NOT NULL,
                balance_after DECIMAL(15,2) NOT NULL,
                metadata TEXT,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (from_wallet_id) REFERENCES user_wallets(id),
                FOREIGN KEY (to_wallet_id) REFERENCES user_wallets(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            );

            -- Create wallet_transaction_logs table
            CREATE TABLE IF NOT EXISTS "wallet_transaction_logs" (
                id SERIAL PRIMARY KEY,
                wallet_id INTEGER NOT NULL,
                transaction_id INTEGER NOT NULL,
                type VARCHAR(20) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                balance_before DECIMAL(15,2) NOT NULL,
                balance_after DECIMAL(15,2) NOT NULL,
                description TEXT,
                reference_type VARCHAR(50),
                reference_id VARCHAR(100),
                user_id INTEGER NOT NULL,
                status VARCHAR(20) NOT NULL,
                additional_metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (wallet_id) REFERENCES user_wallets(id),
                FOREIGN KEY (transaction_id) REFERENCES wallet_transactions(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_wallet_user ON user_wallets(user_id);
            CREATE INDEX IF NOT EXISTS idx_wallet_type ON user_wallets(wallet_type_id);
            CREATE INDEX IF NOT EXISTS idx_wallet_status ON user_wallets(status);
            CREATE INDEX IF NOT EXISTS idx_transaction_from ON wallet_transactions(from_wallet_id);
            CREATE INDEX IF NOT EXISTS idx_transaction_to ON wallet_transactions(to_wallet_id);
            CREATE INDEX IF NOT EXISTS idx_transaction_status ON wallet_transactions(status);
            CREATE INDEX IF NOT EXISTS idx_transaction_type ON wallet_transactions(type);
            CREATE INDEX IF NOT EXISTS idx_transaction_created_at ON wallet_transactions(created_at);
            CREATE INDEX IF NOT EXISTS idx_log_wallet ON wallet_transaction_logs(wallet_id);
            CREATE INDEX IF NOT EXISTS idx_log_transaction ON wallet_transaction_logs(transaction_id);
            CREATE INDEX IF NOT EXISTS idx_log_user ON wallet_transaction_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_log_status ON wallet_transaction_logs(status);
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

            DROP TRIGGER IF EXISTS update_wallet_types_timestamp ON wallet_types;
            CREATE TRIGGER update_wallet_types_timestamp
                BEFORE UPDATE ON wallet_types
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();

            DROP TRIGGER IF EXISTS update_user_wallets_timestamp ON user_wallets;
            CREATE TRIGGER update_user_wallets_timestamp
                BEFORE UPDATE ON user_wallets
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
        `);

        log.info('Wallet service migrations completed successfully');
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
