const config = require('./config.json');
const DB = require('monk')(config.database);
const pg = require('./pg');
const kue = require('kue');
const queue = kue.createQueue({
    prefix: 'kue',
    redis: config.redis
});

queue.process('save_instance_history', function(job, cb) {
    saveInstanceHistory(job.data.instance).then(cb).catch(cb);
});

async function saveInstanceHistory(instanceName) {
    let instance = await DB.get('instances').findOne({
        name: instanceName
    });

    if(!instance)
        throw new Error("Instance not found.");

    let pgc = await pg.connect();

    let pg_instance = await pgc.query('SELECT id FROM instances WHERE name=$1', [instance.name]);

    if(pg_instance.rows.length === 0) {
        pg_instance = await pgc.query('INSERT INTO instances(name) VALUES($1) RETURNING id', [instance.name]);
    }

    let old_res = await pgc.query('SELECT timestamp, users, connections, statuses FROM instances_history WHERE instance=$1', [pg_instance.rows[0].id]);
    let old = old_res.rows[0];

    if(!old || old.timestamp.getTime() - 24*60*60*1000 < new Date().getTime() || old.users !== instance.users || old.connections !== instance.connections || old.statuses !== instance.statuses) {
        console.log(instance.name + ': saving history');

        await pgc.query('INSERT INTO instances_history(instance, uptime_all, ipv6, https_score, obs_score, users, connections, statuses, ' +
            'open_registrations, version) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [
            pg_instance.rows[0].id,
            instance.uptime || 0,
            instance.ipv6 || false,
            instance.https_score || 0,
            instance.obs_score || 0,
            instance.users || 0,
            instance.connections || 0,
            instance.statuses || 0,
            instance.openRegistrations || false,
            instance.version || null
        ]);
    } else {
        console.log(instance.name + ': no history save needed');
    }

    await pgc.release();
}