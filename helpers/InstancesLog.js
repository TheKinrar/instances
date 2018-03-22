const pg = require('../pg');

module.exports = {
    log,

    info,
    warning,
    error
};

async function log(instance, level, content) {
    if(typeof instance === 'string') {
        let pg_res = await pg.query('SELECT id FROM instances WHERE name=$1', [instance]);

        if(pg_res.rows.length !== 1)
            throw("Could not get PG instance id. Rows: " + pg_res.rows.length);

        instance = pg_res.rows[0].id;
    }

    await pg.query('INSERT INTO instances_log_entries(instance, level, content) ' +
        'VALUES($1, $2, $3)', [
            instance,
            level,
            content
    ]);
}

async function info(instance, content) {
    await log(instance, 0, content);
}

async function warning(instance, content) {
    await log(instance, 1, content);
}

async function error(instance, content) {
    await log(instance, 1, content);
}