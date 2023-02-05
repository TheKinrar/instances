const {Resolver} = require('node:dns/promises');
const got = require('got');

const instance = module.exports = got.extend({
    timeout: {
        lookup: 100, // 0.1s for DNS lookup
        connect: 5000, // 5s for initial connection
        socket: 1000, // 1s without receiving any data
        request: 30000 // 30s for the full request
    },
    headers: {
        'User-Agent': 'MastodonInstances (https://instances.social)'
    },
    followRedirect: false,
    retry: {limit: 0}
});

const resolver = new Resolver();
resolver.setServers([
    '2606:4700:4700::1111',
    '2606:4700:4700::1001',
    '1.1.1.1',
    '1.0.0.1'
]);

import('cacheable-lookup').then(({default: CacheableLookup}) => {
    instance.defaults.options.dnsCache = new CacheableLookup({
        resolver: resolver,
        lookup: false
    });
});
