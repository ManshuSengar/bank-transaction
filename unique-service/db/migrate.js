// unique-service/db/migrate.js
const { sql } = require('drizzle-orm');
const { db } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('Unique-Service-Migration');

async function migrate() {
    try {
        log.info('Starting unique ID service migrations...');
        
        // Execute migrations as raw SQL
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "unique_id_tracking" (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                original_unique_id VARCHAR(100) NOT NULL,
                generated_unique_id VARCHAR(100) NOT NULL UNIQUE,
                amount DECIMAL(15,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                CONSTRAINT unq_user_original_id UNIQUE(user_id, original_unique_id)
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_unique_tracking_user ON unique_id_tracking(user_id);
            CREATE INDEX IF NOT EXISTS idx_unique_tracking_original ON unique_id_tracking(original_unique_id);
            CREATE INDEX IF NOT EXISTS idx_unique_tracking_generated ON unique_id_tracking(generated_unique_id);
            CREATE INDEX IF NOT EXISTS idx_unique_tracking_status ON unique_id_tracking(status);
            CREATE INDEX IF NOT EXISTS idx_unique_tracking_created ON unique_id_tracking(created_at);
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

            DROP TRIGGER IF EXISTS update_unique_tracking_timestamp ON unique_id_tracking;
            CREATE TRIGGER update_unique_tracking_timestamp
                BEFORE UPDATE ON unique_id_tracking
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
        `);

        log.info('Unique ID service migrations completed successfully');
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
