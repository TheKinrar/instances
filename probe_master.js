const tls = require('tls');
tls.DEFAULT_ECDH_CURVE = 'auto'; // Fix that should not be needed but is because Node is stupid

const config = require('./config');
const queue = require('./queue');
const Instance = require('./models/instance');
const Probe = require('./models/probe');
const Ping = require('./models/ping');

const io = require('socket.io')();

io.use((socket, next) => {
    if(socket.handshake.query.token === config.probe.token) {
        if(typeof socket.handshake.query.probe === 'string') {
            Probe.findByPk(socket.handshake.query.probe).then((probe) => {
                if(probe) {
                    console.log('probe #' + socket.handshake.query.probe + ':' + probe.name + ' connecting');
                    next();
                } else {
                    next(new Error('invalid probe'));
                }
            });

            return;
        }
    }

    return next(new Error('unauthorized'));
});

io.on('connection', (socket) => {
    console.log('probe #' + socket.handshake.query.probe + ' connected');

    socket.on('ping_results', (results) => {
        console.log(results.length + ' results received, saving');

        Ping.bulkCreate(results.map(r => ({
            instance: r.inst,
            probe: socket.handshake.query.probe,

            success: !r.err,
            error: r.err,

            average: r.avg,
            jitter: r.jit
        }))).catch(console.error);
    });
});

io.listen(8738);

process('ping_all', 1, pingAll);

function process(job, n, fn) {
    queue.process(job, n, (job, cb) => {
        fn(job.data).then(cb).catch(cb);
    });
}

async function pingAll() {
    console.log('sending ping all');

    io.emit('ping', (await Instance.findAll({
        where: {
            dead: false
        }
    })).map(i => ({id: i.id, name: i.name})));
}
