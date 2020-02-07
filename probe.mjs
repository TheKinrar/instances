import IO from 'socket.io-client';
import TCPPing from 'tcp-ping';
import Pool from 'es6-promise-pool';
import config from './config.mjs';

const io = IO(config.probe.master_url + '?token=' + config.probe.token + '&probe=' + config.probe.probe);

io.on('ping', (data) => {
    if(!Array.isArray(data))
        return;

    pingAll(data).then(results => {
        io.emit('ping_results', results);
    }).catch(console.error);
});

function pingAll(instances) {
    return new Promise((resolve, reject) => {
        let results = [];

        function * it() {
            for(let instance of instances) {
                yield pingOne(instance);
            }
        }

        const pool = new Pool(it(), config.probe.concurrency);

        pool.addEventListener('fulfilled', (event) => {
            results.push(event.data.result);
        });

        pool.addEventListener('rejected', (event) => {
            results.push({inst: event.data.promise.instance.id, date: new Date(), err: event.data.error.message});
        });

        pool.start().then(() => {
            resolve(results);
        }).catch(reject);
    });
}

function pingOne(instance) {
    let p = new Promise((resolve, reject) => {
        TCPPing.ping({
            address: instance.name,
            port: 443,
            timeout: 1000
        }, (err, rs) => {
            if(err) return reject(new Error(err.message));

            let jit = 0;
            for(let e of rs.results) {
                if(e.err)
                    return reject(new Error(e.err.message));

                jit += Math.abs(rs.avg - e.time);
            }
            jit /= rs.attempts;

            return resolve({
                inst: instance.id,
                date: new Date(),
                avg: rs.avg,
                jit
            });
        });
    });
    p.instance = instance;
    return p;
}
