const pg = require('../pg');
const pgFormat = require('pg-format');

module.exports = {
    log,

    info,
    warning,
    error
};

async function log(instance, level, content) {
    await pg.query('INSERT INTO instances_log_entries(instance, level, content) ' +
        'VALUES($1, $2, $3)', [
            instance,
            level,
            content
    ]);

    let old_log_entries = await pg.query('SELECT id FROM instances_log_entries WHERE instance=$1 ORDER BY id DESC OFFSET 100 ROWS', [
        instance
    ]);

    if(old_log_entries.rows.length !== 0)
        await pg.query(pgFormat('DELETE FROM instances_log_entries WHERE id IN (%L)'), old_log_entries.rows.map(e => e.id));
}

async function info(instance, content) {
    await log(instance, 0, content);
}

async function warning(instance, content) {
    await log(instance, 1, content);
}

async function error(instance, content) {
    await log(instance, 2, content);
}
