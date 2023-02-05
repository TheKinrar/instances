const tls = require('tls');
tls.DEFAULT_ECDH_CURVE = 'auto'; // Fix that should not be needed but is because Node is stupid

const config = require('./config.json');
const DB = require('monk')(config.database, {
    connectTimeoutMS: 1000
});
const pg = require('./pg');
const queue = require('./queue');
const request = require('./helpers/request');
const pgFormat = require('pg-format');
const Instance = require('./models/instance');
const FlakeId = require('flakeid');
const isValidDomain = require('is-valid-domain');
const fs = require('fs');

let domain_blacklist = [];
if(fs.existsSync(__dirname + '/domain_blacklist')) {
    domain_blacklist = fs.readFileSync(__dirname + '/domain_blacklist', 'utf8')
        .split('\n').filter(Boolean);
}

const flake = new FlakeId({
    timeOffset: 1608422400000
});

queue.setMaxListeners(501);

process('check_instance', 100,
    require('./jobs/check_instance'));

process('check_instance_https', 100,
    require('./jobs/check_instance_https'));

process('check_instance_obs', 100,
    require('./jobs/check_instance_obs'));

process('save_instance_history', 100,
    saveInstanceHistory);

process('fetch_instance_ap', 100,
    fetchInstanceAP);

function process(job, n, fn) {
    queue.process(job, n, (job, cb) => {
        fn(job.data).then(cb).catch(cb);
    });
}

async function saveInstanceHistory(options) {
    let id = options.instance;

    let instance = await Instance.findByPk(id);

    if(!instance) {
        throw new Error(`Instance ${id} not found.`);
    }

    instance.latest_history_save = new Date();
    await instance.save();

    await pg.query('INSERT INTO instances_history(instance, uptime_all, up, ipv6, https_score, obs_score, ' +
        'users, connections, statuses, open_registrations, version) ' +
        'VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [
        id,
        instance.uptime_all || 0,
        instance.up || false,
        instance.ipv6 || false,
        instance.https_score || 0,
        instance.obs_score || 0,
        instance.users || 0,
        instance.connections || 0,
        instance.statuses || 0,
        instance.open_registrations || false,
        instance.version || null
    ]);
}

async function fetchInstanceAP(options) {
    let id = options.instance;

    let instance = await Instance.findByPk(id);

    if(!instance) {
        throw new Error(`Instance ${id} not found.`);
    }

    instance.latest_ap_check = new Date();
    await instance.save();

    try {
        let peers = (await request({
            url: `https://${instance.name}/api/v1/instance/peers`,
            json: true
        })).filter(p => isValidDomain(p, {allowUnicode: true, subdomain: true}))
            .map(p => p.toLowerCase())
            .filter(p => !domain_blacklist.some(d => p.endsWith(d)));

        let existing = await pg.query(pgFormat('SELECT lower(name) AS name FROM instances WHERE lower(name) IN (%L)', peers));
        let missing = peers.filter(p => !existing.rows.some(r => r.name === p));

        let values = missing
            .map(p => [
                flake.gen(),
                p,
                instance.id
            ]);

        if(values.length !== 0) {
            await pg.query(pgFormat('INSERT INTO instances(id, name, discovered_from) VALUES %L', values));
        }
    } catch(e) {}

    try {
        let activity = await request({
            url: `https://${instance.name}/api/v1/instance/activity`,
            json: true
        });

        for(let activity_w of activity) {
            await pg.query('INSERT INTO instances_activity(instance, week, statuses, logins, registrations) ' +
                'VALUES($1, $2, $3, $4, $5) ON CONFLICT (instance, week) ' +
                'DO UPDATE SET statuses=EXCLUDED.statuses, logins=EXCLUDED.logins, registrations=EXCLUDED.registrations ' +
                'WHERE instances_activity.instance=EXCLUDED.instance AND instances_activity.week=EXCLUDED.week', [
                id,
                new Date(parseInt(activity_w.week) * 1000),
                activity_w.statuses,
                activity_w.logins,
                activity_w.registrations
            ]);
        }

        await DB.get('instances').update({
            name: instance.name
        }, {
            $set: {
                activity_prevw: {
                    statuses: parseInt(activity[1].statuses),
                    logins: parseInt(activity[1].logins),
                    registrations: parseInt(activity[1].registrations)
                }
            }
        });
    } catch(e) {}
}
