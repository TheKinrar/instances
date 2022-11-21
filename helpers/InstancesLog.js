const pg = require('../pg');

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
