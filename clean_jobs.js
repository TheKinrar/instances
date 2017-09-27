const config = require('./config.json');
const kue = require('kue');
const queue = kue.createQueue({
    prefix: 'kue',
    redis: config.redis
});
const pify = require('pify');

queue.complete = pify(queue.complete.bind(queue));
queue.failed = pify(queue.failed.bind(queue));
kue.Job.get = pify(kue.Job.get);

(async () => {
    let ids = await queue.complete();

    for(let id of ids) {
        let job = await kue.Job.get(id);

        await pify(job.remove.bind(job))();
    }
})().catch(console.error);

(async () => {
    let ids = await queue.failed();

    for(let id of ids) {
        let job = await kue.Job.get(id);

        await pify(job.remove.bind(job))();
    }
})().catch(console.error);