const { sql } = require('drizzle-orm');
const { db } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('Scheme-Service-Migration');

async function migrate() {
    try {
        log.info('Starting scheme service migrations...');
        
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS schemes (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                status VARCHAR(20) DEFAULT 'INACTIVE',
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS scheme_charges (
                id SERIAL PRIMARY KEY,
                scheme_id INTEGER REFERENCES schemes(id) ON DELETE CASCADE,
                payout_range VARCHAR(50) NOT NULL,
                charge_type VARCHAR(20) NOT NULL,
                charge_value DECIMAL(10,2) NOT NULL,
                partner_value DECIMAL(10,2),
                apiuser_value DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_schemes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                scheme_id INTEGER REFERENCES schemes(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, scheme_id)
            );
        `);

        // Create indexes
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_schemes_status ON schemes(status);
            CREATE INDEX IF NOT EXISTS idx_scheme_charges_scheme ON scheme_charges(scheme_id);
            CREATE INDEX IF NOT EXISTS idx_user_schemes_user ON user_schemes(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_schemes_scheme ON user_schemes(scheme_id);
        `);

        log.info('Scheme service migrations completed successfully');
    } catch (error) {
        log.error('Error during scheme migration:', error);
        throw error;
    }
}

module.exports = { migrate };