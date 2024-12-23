// user-service/db/migrate.js
const { sql } = require('drizzle-orm');
const { db } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('User-Service-Migration');

async function migrate() {
    try {
        log.info('Starting user service migrations...');
        
        // Execute migrations as raw SQL
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS permissions (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                firstname VARCHAR(100) NOT NULL,
                lastname VARCHAR(100) NOT NULL,
                email_id VARCHAR(255) NOT NULL UNIQUE,
                username VARCHAR(100) NOT NULL UNIQUE,
                date_of_birth TIMESTAMP NOT NULL,
                password VARCHAR(255) NOT NULL,
                phone_no VARCHAR(10) NOT NULL,
                role_id INTEGER REFERENCES roles(id),
                password_reset_token VARCHAR(255),
                password_reset_expires TIMESTAMP,
                last_login TIMESTAMP,
                last_login_ip VARCHAR(45),
                last_login_location TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS role_permissions (
                id SERIAL PRIMARY KEY,
                role_id INTEGER REFERENCES roles(id),
                permission_id INTEGER REFERENCES permissions(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(role_id, permission_id)
            );

            CREATE TABLE IF NOT EXISTS user_permissions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                permission_id INTEGER REFERENCES permissions(id),
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, permission_id)
            );

            CREATE TABLE IF NOT EXISTS addresses (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                firstline VARCHAR(255) NOT NULL,
                secondline VARCHAR(255),
                city VARCHAR(100) NOT NULL,
                state VARCHAR(100),
                country VARCHAR(100) NOT NULL,
                pin VARCHAR(10) NOT NULL,
                address_type VARCHAR(50) DEFAULT 'HOME',
                is_primary BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS business_information (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                shop_name VARCHAR(100) NOT NULL,
                pancard_number VARCHAR(10) NOT NULL UNIQUE,
                adhaar_number VARCHAR(12) NOT NULL UNIQUE,
                business_email VARCHAR(255),
                business_domain VARCHAR(255),
                rm_code VARCHAR(50),
                business_type VARCHAR(50),
                business_category VARCHAR(100),
                gst_number VARCHAR(15),
                establishment_year INTEGER,
                annual_turnover DECIMAL(15,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            );

            CREATE TABLE IF NOT EXISTS user_sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                session_token VARCHAR(255) NOT NULL,
                device_info TEXT,
                ip_address VARCHAR(45),
                user_agent TEXT,
                latitude REAL,
                longitude REAL,
                login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_activity_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                session_id INTEGER REFERENCES user_sessions(id),
                activity_type VARCHAR(50) NOT NULL,
                description TEXT,
                ip_address VARCHAR(45),
                user_agent TEXT,
                latitude REAL,
                longitude REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_login_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address VARCHAR(45) NOT NULL,
                user_agent TEXT,
                device_info TEXT,
                latitude REAL,
                longitude REAL,
                login_status VARCHAR(20) NOT NULL,
                failure_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email_id);
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_no);
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
            
            CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
            CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
            
            CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission_id);
            
            CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
            CREATE INDEX IF NOT EXISTS idx_business_info_user ON business_information(user_id);
            
            CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
            
            CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON user_activity_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_activity_logs_session ON user_activity_logs(session_id);
            
            CREATE INDEX IF NOT EXISTS idx_login_history_user ON user_login_history(user_id);
            CREATE INDEX IF NOT EXISTS idx_login_history_status ON user_login_history(login_status);
        `);

        // Add triggers for updated_at timestamp
        await db.execute(sql`
            CREATE OR REPLACE FUNCTION update_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';

            DROP TRIGGER IF EXISTS update_users_timestamp ON users;
            CREATE TRIGGER update_users_timestamp
                BEFORE UPDATE ON users
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();

            DROP TRIGGER IF EXISTS update_roles_timestamp ON roles;
            CREATE TRIGGER update_roles_timestamp
                BEFORE UPDATE ON roles
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();

            DROP TRIGGER IF EXISTS update_permissions_timestamp ON permissions;
            CREATE TRIGGER update_permissions_timestamp
                BEFORE UPDATE ON permissions
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();

            DROP TRIGGER IF EXISTS update_user_permissions_timestamp ON user_permissions;
            CREATE TRIGGER update_user_permissions_timestamp
                BEFORE UPDATE ON user_permissions
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();

            DROP TRIGGER IF EXISTS update_addresses_timestamp ON addresses;
            CREATE TRIGGER update_addresses_timestamp
                BEFORE UPDATE ON addresses
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();

            DROP TRIGGER IF EXISTS update_business_information_timestamp ON business_information;
            CREATE TRIGGER update_business_information_timestamp
                BEFORE UPDATE ON business_information
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
        `);

        log.info('User service migrations completed successfully');
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
