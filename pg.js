const { Pool } = require('pg');

const pool = new Pool({
    user: 'instances',
    host: 'localhost',
    database: 'instances',
    password: 'Sho9gaixoNg0Thie1Ahba4ohy7ohqu5oot5caehia4eithei3koop0iot7oothie',
    port: 6432
});

module.exports = pool;