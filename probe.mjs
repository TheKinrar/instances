import IO from 'socket.io-client';
import TCPPing from 'tcp-ping';
import config from './config.mjs';

const io = IO(config.probe.master_url + '?token=' + config.probe.token + '&probe=' + config.probe.probe);

io.on('ping', (data) => {
    if(!Array.isArray(data))
        return;

    pingAll(data).then(results => {
        io.emit('ping_results', results);
    }).catch(console.error);
});

async function pingAll(instances) {
    let results = [];

    for(let instance of instances) {
        try {
            results.push(await pingOne(instance));
            return results;
        } catch(e) {
            results.push({inst: instance.id, date: new Date(), err: e.message});
        }
    }

    return results;
}

function pingOne(instance) {
    return new Promise((resolve, reject) => {
        TCPPing.ping({
            address: instance.name,
            port: 443
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
}
