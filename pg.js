const { Pool } = require('pg');

const pool = new Pool({
    user: 'instances',
    host: 'localhost',
    database: 'instances',
    password: 'yeNgie0oochievoep2eiku6riadaecoh5ejohfeixiejah6queide1thahpahhie',
    port: 6432
});

module.exports = pool;