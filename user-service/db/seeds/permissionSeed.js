// user-service/db/seeds/permissions.js
const { db, permissions, roles, rolePermissions } = require('../schema');
const Logger = require('../../../logger/logger');
const log = new Logger('Permissions-Seeder');
const { eq, inArray } = require('drizzle-orm');

// Define all system permissions
const systemPermissions = [
    // User Management Permissions
    { name: 'view_users', description: 'Can view list of users' },
    { name: 'manage_users', description: 'Can create, edit, and delete users' },
    { name: 'view_own_profile', description: 'Can view own profile details' },
    { name: 'edit_own_profile', description: 'Can edit own profile details' },

    // Role & Permission Management
    { name: 'view_roles', description: 'Can view roles' },
    { name: 'manage_roles', description: 'Can create, edit, and delete roles' },
    { name: 'assign_roles', description: 'Can assign roles to users' },
    { name: 'view_permissions', description: 'Can view permissions' },
    { name: 'manage_permissions', description: 'Can manage permissions' },

    // API Token Management
    { name: 'view_api_tokens', description: 'Can view API tokens' },
    { name: 'manage_api_tokens', description: 'Can create and manage API tokens' },
    { name: 'approve_api_tokens', description: 'Can approve or reject API token requests' },

    // Callback Management
    { name: 'view_callbacks', description: 'Can view callback configurations' },
    { name: 'manage_callbacks', description: 'Can manage callback configurations' },
    { name: 'view_callback_logs', description: 'Can view callback logs' },

    // Fund Management
    { name: 'request_funds', description: 'Can request funds' },
    { name: 'view_fund_requests', description: 'Can view fund requests' },
    { name: 'manage_fund_requests', description: 'Can approve/reject fund requests' },
    { name: 'view_fund_logs', description: 'Can view fund transaction logs' },

    // Bank Management
    { name: 'view_banks', description: 'Can view bank accounts' },
    { name: 'manage_banks', description: 'Can add and manage bank accounts' },
    { name: 'view_bank_transactions', description: 'Can view bank transactions' },

    // KYC Management
    { name: 'submit_kyc', description: 'Can submit KYC documents' },
    { name: 'view_kyc', description: 'Can view KYC details' },
    { name: 'manage_kyc', description: 'Can verify and manage KYC documents' },

    // Wallet Management
    { name: 'view_wallets', description: 'Can view wallet details' },
    { name: 'manage_wallets', description: 'Can manage wallet operations' },
    { name: 'view_wallet_transactions', description: 'Can view wallet transactions' },

    // Transaction Management
    { name: 'view_transactions', description: 'Can view transactions' },
    { name: 'manage_transactions', description: 'Can manage transactions' },

    // Payin Management
    { name: 'create_payin', description: 'Can create payin transactions' },
    { name: 'view_payin', description: 'Can view payin transactions' },
    { name: 'manage_payin', description: 'Can manage payin transactions' },

    // Payout Management
    { name: 'create_payout', description: 'Can create payout transactions' },
    { name: 'view_payout', description: 'Can view payout transactions' },
    { name: 'manage_payout', description: 'Can manage payout transactions' },

    // Report Management
    { name: 'view_reports', description: 'Can view reports' },
    { name: 'generate_reports', description: 'Can generate custom reports' },
    { name: 'export_reports', description: 'Can export reports' },

    // System Settings
    { name: 'view_settings', description: 'Can view system settings' },
    { name: 'manage_settings', description: 'Can manage system settings' }
];

// Default roles with their permissions
const defaultRoles = [
    {
        name: 'SUPER_ADMIN',
        description: 'Super Administrator with full system access',
        permissions: ['*'] // All permissions
    },
    {
        name: 'ADMIN',
        description: 'Administrator with limited system access',
        permissions: [
            'view_users', 'manage_users', 'view_roles', 'manage_roles',
            'view_permissions', 'manage_api_tokens', 'approve_api_tokens',
            'manage_callbacks', 'manage_fund_requests', 'manage_kyc',
            'manage_wallets', 'manage_transactions', 'manage_settings'
        ]
    },
    {
        name: 'USER',
        description: 'Regular user with basic access',
        permissions: [
            'view_own_profile', 'edit_own_profile', 'submit_kyc',
            'view_wallets', 'view_transactions', 'create_payin',
            'create_payout', 'request_funds', 'view_reports'
        ]
    }
];

async function seedPermissions() {
    try {
        log.info('Starting permissions seeding...');

        // Create all permissions
        for (const perm of systemPermissions) {
            try {
                const [createdPerm] = await db
                    .insert(permissions)
                    .values(perm)
                    .onConflictDoUpdate({
                        target: permissions.name,
                        set: { description: perm.description }
                    })
                    .returning();
                log.info(`Created/Updated permission: ${perm.name}`);
            } catch (error) {
                log.error(`Error creating permission ${perm.name}:`, error);
                throw error;
            }
        }

        // Create default roles and assign permissions
        for (const roleData of defaultRoles) {
            try {
                // Create role
                const [role] = await db
                    .insert(roles)
                    .values({
                        name: roleData.name,
                        description: roleData.description
                    })
                    .onConflictDoUpdate({
                        target: roles.name,
                        set: { description: roleData.description }
                    })
                    .returning();

                log.info(`Created/Updated role: ${roleData.name}`);

                // Get all permissions
                let permsToAssign;
                if (roleData.permissions.includes('*')) {
                    permsToAssign = await db.select().from(permissions);
                } else {
                    permsToAssign = await db
                        .select()
                        .from(permissions)
                        .where(inArray(permissions.name, roleData.permissions));
                }

                // Delete existing role permissions
                await db
                    .delete(rolePermissions)
                    .where(eq(rolePermissions.roleId, role.id));

                // Assign new permissions to role
                for (const perm of permsToAssign) {
                    await db
                        .insert(rolePermissions)
                        .values({
                            roleId: role.id,
                            permissionId: perm.id
                        })
                        .onConflictDoNothing();
                }

                log.info(`Assigned permissions to role: ${roleData.name}`);
            } catch (error) {
                log.error(`Error processing role ${roleData.name}:`, error);
                throw error;
            }
        }

        log.info('Permission seeding completed successfully');
    } catch (error) {
        log.error('Error seeding permissions:', error);
        throw error;
    }
}

// Run seeder if executed directly
if (require.main === module) {
    seedPermissions()
        .then(() => {
            log.info('Permission seeding completed successfully');
            process.exit(0);
        })
        .catch(error => {
            log.error('Permission seeding failed:', error);
            process.exit(1);
        });
}

module.exports = { seedPermissions, systemPermissions, defaultRoles };