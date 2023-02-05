require('dns').setDefaultResultOrder('verbatim');

module.exports = require('got').extend({
    timeout: {
        lookup: 100, // 0.1s for DNS lookup
        connect: 5000, // 5s for initial connection
        socket: 1000, // 1s without receiving any data
        request: 30000 // 30s for the full request
    },
    headers: {
        'User-Agent': 'MastodonInstances (https://instances.social)'
    },
    followRedirect: false
});
