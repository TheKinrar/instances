const config = require('./config.json');
const DB = require('monk')(config.database);
const pg = require('./pg');
const kue = require('kue');
const queue = kue.createQueue({
    prefix: 'kue',
    redis: config.redis
});
const request = require('request-promise-native').defaults({
    headers: {
        'User-Agent': 'MastodonInstances (https://instances.social)'
    }
});
const pgFormat = require('pg-format');

queue.process('save_instance_history', function(job, cb) {
    saveInstanceHistory(job.data.instance).then(cb).catch(cb);
});

queue.process('fetch_instance_ap', function(job, cb) {
    fetchInstanceAP(job.data.instance).then(cb).catch(cb);
});

async function saveInstanceHistory(id) {
    let pgc = await pg.connect();
    let pg_instance_res = await pgc.query('SELECT name FROM instances WHERE id=$1', [id]);

    if(pg_instance_res.rows.length === 0) {
        throw new Error(`Instance ${id} not found.`);
    }

    let pg_instance = pg_instance_res.rows[0];

    let instance = await DB.get('instances').findOne({
        name: pg_instance.name
    });

    if(!instance)
        throw new Error(`MongoDB instance ${pg_instance.name} not found.`);

    try {
        await pgc.query('BEGIN');

        let res = await pgc.query('INSERT INTO instances_history(instance, uptime_all, ipv6, https_score, obs_score, ' +
            'users, connections, statuses, open_registrations, version, ' +
            'active_users_30d, active_users_14d, active_users_7d, active_users_1d, active_users_1h, ' +
            'first_user_created_at) ' +
            'VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING(timestamp)', [
            id,
            instance.uptime || 0,
            instance.ipv6 || false,
            instance.https_score || 0,
            instance.obs_score || 0,
            instance.users || 0,
            instance.connections || 0,
            instance.statuses || 0,
            instance.openRegistrations || false,
            instance.version || null,
            instance.active_user_count ? (instance.active_user_count['30d'] || null) : null,
            instance.active_user_count ? (instance.active_user_count['14d'] || null) : null,
            instance.active_user_count ? (instance.active_user_count['7d'] || null) : null,
            instance.active_user_count ? (instance.active_user_count['1d'] || null) : null,
            instance.active_user_count ? (instance.active_user_count['1h'] || null) : null,
            instance.first_user_created_at || null
        ]);

        await pgc.query('UPDATE instances SET latest_history_save=$1, uptime_all=$3, ipv6=$4, https_score=$5,' +
            'obs_score=$6, users=$7, connections=$8, statuses=$9, open_registrations=$10, version=$11, ' +
            'active_users_30d=$12, active_users_14d=$13, active_users_7d=$14, active_users_1d=$15, ' +
            'active_users_1h=$16, first_user_created_at=$17 WHERE id=$2', [
            res.rows[0].timestamp,
            id,
            instance.uptime || 0,
            instance.ipv6 || false,
            instance.https_score || 0,
            instance.obs_score || 0,
            instance.users || 0,
            instance.connections || 0,
            instance.statuses || 0,
            instance.openRegistrations || false,
            instance.version || null,
            instance.active_user_count ? (instance.active_user_count['30d'] || null) : null,
            instance.active_user_count ? (instance.active_user_count['14d'] || null) : null,
            instance.active_user_count ? (instance.active_user_count['7d'] || null) : null,
            instance.active_user_count ? (instance.active_user_count['1d'] || null) : null,
            instance.active_user_count ? (instance.active_user_count['1h'] || null) : null,
            instance.first_user_created_at || null
        ]);

        await pgc.query('COMMIT');
    } catch(e) {
        await pgc.query('ROLLBACK');
        throw e;
    } finally {
        await pgc.release();
    }
}

async function fetchInstanceAP(id) {
    let pg_instance_res = await pg.query('SELECT name FROM instances WHERE id=$1', [id]);

    if(pg_instance_res.rows.length === 0) {
        throw new Error(`Instance ${id} not found.`);
    }

    let pg_instance = pg_instance_res.rows[0];

    let instance = await DB.get('instances').findOne({
        name: pg_instance.name
    });

    if(!instance)
        throw new Error(`MongoDB instance ${pg_instance.name} not found.`);

    await DB.get('instances').update({
        name: pg_instance.name
    }, {
        $set: {
            apUpdatedAt: new Date()
        }
    });

    let peers = await request({
        url: `https://${instance.name}/api/v1/instance/peers`,
        json: true
    });

    let newInstances = await pg.query(pgFormat('INSERT INTO instances(name) VALUES %L ON CONFLICT DO NOTHING RETURNING id,name', peers.map(p => [p])));

    await DB.get('instances').insert(newInstances.rows.map(i => ({
        addedAt: new Date(),
        name: i.name,
        downchecks: 0,
        upchecks: 0
    })));
}