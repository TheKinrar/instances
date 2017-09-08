const config = require('./config.json');
const DB = require('monk')(config.database);
const pg = require('./pg');
const random = require("random-js")();
const pify = require('pify');
const kue = require('kue');
const queue = kue.createQueue({
    prefix: 'kue',
    redis: config.redis
});

(async function() {
    let instances = await DB.get('instances').find({
        blacklisted: {
            $ne: true
        }, dead: {
            $ne: true
        }, upchecks: {
            $gt: 0
        }
    });

    for(let instance of instances) {
        let job = queue.create('save_instance_history', {
            title: instance.name,
            instance: instance.name
        }).delay(random.integer(0, 3600000)).ttl(60000);

        await pify(job.save.bind(job))();
    }

    process.exit(0);
})().catch((e) => {
    console.error(e);

    process.exit(1);
});