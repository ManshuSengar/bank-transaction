// user-service/db/seed.js
const { db, roles, permissions, rolePermissions, users, addresses } = require('./schema');
const Logger = require('../../logger/logger');
const log = new Logger('User-Service-Seed');
const bcrypt = require('bcryptjs');
const { sql } = require('drizzle-orm');
const { eq } = require('drizzle-orm');

// Test database connection
async function testConnection() {
    try {
        await db.execute(sql`SELECT 1`);
        log.info('Database connection successful');
        return true;
    } catch (error) {
        log.error('Database connection failed:', error);
        return false;
    }
}

async function seedDatabase() {
    try {
        log.info('Starting database seeding...');

        // Test connection first
        const isConnected = await testConnection();
        if (!isConnected) {
            throw new Error('Unable to establish database connection');
        }

        // Create permissions
        log.info('Creating default permissions...');
        const createdPermissions = {};
        
        for (const perm of defaultPermissions) {
            try {
                log.info(`Processing permission: ${perm.name}`);
                
                // Try a simple query first to validate our query capability
                const testQuery = await db.execute(sql`SELECT 1`);
                log.info('Test query successful');

                // Now try to find existing permission
                const existingPerms = await db.execute(
                    sql`SELECT * FROM permissions WHERE name = ${perm.name}`
                );
                
                if (existingPerms.rowCount > 0) {
                    log.info(`Updating existing permission: ${perm.name}`);
                    const [updatedPerm] = await db.execute(
                        sql`UPDATE permissions 
                            SET description = ${perm.description},
                                updated_at = NOW()
                            WHERE name = ${perm.name}
                            RETURNING *`
                    );
                    createdPermissions[perm.name] = updatedPerm.rows[0].id;
                } else {
                    log.info(`Creating new permission: ${perm.name}`);
                    const [newPerm] = await db.execute(
                        sql`INSERT INTO permissions (name, description)
                            VALUES (${perm.name}, ${perm.description})
                            RETURNING *`
                    );
                    createdPermissions[perm.name] = newPerm.rows[0].id;
                }
            } catch (error) {
                log.error(`Error processing permission ${perm.name}:`, error);
                throw error;
            }
        }

        // The rest of the seeding logic...
        // (Keeping the roles and admin user creation for brevity, will add if needed)

        log.info('Database seeding completed successfully');
    } catch (error) {
        log.error('Error seeding database. Full error:', error);
        log.error('Error stack:', error.stack);
        throw error;
    }
}

// Define default permissions for banking app
const defaultPermissions = [
    { name: 'view_users', description: 'Can view user list' },
    { name: 'manage_users', description: 'Can create, edit and delete users' },
    { name: 'view_own_profile', description: 'Can view own profile' },
    { name: 'edit_own_profile', description: 'Can edit own profile' },
    { name: 'manage_roles', description: 'Can manage roles and permissions' },
    { name: 'view_accounts', description: 'Can view account details' },
    { name: 'manage_accounts', description: 'Can manage account operations' },
    { name: 'view_transactions', description: 'Can view transactions' },
    { name: 'perform_transactions', description: 'Can perform transactions' },
    { name: 'manage_transactions', description: 'Can manage transaction operations' }
];

// Run seeding if script is executed directly
if (require.main === module) {
    seedDatabase()
        .then(() => {
            log.info('Seeding completed successfully');
            process.exit(0);
        })
        .catch(error => {
            log.error('Seeding failed. Error:', error);
            log.error('Error stack:', error.stack);
            process.exit(1);
        });
}

module.exports = { seedDatabase };