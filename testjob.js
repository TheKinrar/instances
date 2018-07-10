const queue = require('./queue');

const job = queue.create('check_instance', {
    title: 'mastodon.xyz',
    instance: 2
}).ttl(60000);

job.save(() => {
    process.exit(0);
});