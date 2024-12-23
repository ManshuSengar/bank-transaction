// drizzle.config.js
const config = require('config');
const dbConfig = config.get('postgres-config');
const path = require('path');

module.exports = {
    schema: [
        './user-service/db/schema.js',
        './api-config-service/db/schema.js',
        './api-token-service/db/schema.js',
        './bank-service/db/schema.js',
        './callback-service/db/schema.js',
        './fund-service/db/schema.js',
        './kyc-service/db/schema.js',
        './payin-service/db/schema.js',
        './product-service/db/schema.js',
        './scheme-service/db/schema.js',
        './unique-service/db/schema.js',
        './wallet-service/db/schema.js'
    ],
    out: './drizzle/migrations',
    driver: 'pg',
    dbCredentials: {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
    },
    verbose: true,
    strict: true
};