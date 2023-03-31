const {Resolver} = require('node:dns/promises');
const {V4MAPPED} = require('node:dns');
const got = require('got');

const instance = module.exports = got.extend({
    mutableDefaults: true,
    timeout: {
        lookup: 100, // 0.1s for DNS lookup
        connect: 5000, // 5s for initial connection
        socket: 5000, // 5s without receiving any data
        request: 30000 // 30s for the full request
    },
    headers: {
        'User-Agent': 'MastodonInstances (https://instances.social)'
    },
    followRedirect: false,
    retry: {limit: 0},

    // Default to IPv6, fall back to IPv4 (via IPv4-mapped IPv6 addresses)
    dnsLookupIpVersion: 'ipv6',
    hints: V4MAPPED
});

import('cacheable-lookup').then(({default: CacheableLookup}) => {
    let cacheable = new CacheableLookup({
        lookup: false // Do not fall back to Node's dns.lookup
    });
    cacheable.servers = [ // Cloudflare DNS
        '2606:4700:4700::1111',
        '2606:4700:4700::1001',
        '1.1.1.1',
        '1.0.0.1'
    ];
    instance.defaults.options.dnsCache = cacheable;
});
