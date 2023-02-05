const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
    host: config.postgresql.host,
    port: config.postgresql.port,
    database: config.postgresql.database,
    user: config.postgresql.username,
    password: config.postgresql.password,
    connectionTimeoutMillis: 3000
});

module.exports = pool;
