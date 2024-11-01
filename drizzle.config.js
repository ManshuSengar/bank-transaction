const config = require('config');
const dbConfig = config.get('postgres-config');
module.exports = {
    schema: './user-service/db/schema.js',
    out: './user-service/db/migrations',
    driver: 'pg',
    dbCredentials: {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
    }
};