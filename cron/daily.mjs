import queue from '../queue.js';

const job = queue.create('ping_all').ttl(60000);

job.save(() => {
    process.exit(0);
});
