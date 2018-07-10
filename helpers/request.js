module.exports = require('request-promise-native').defaults({
    timeout: 30000,
    headers: {
        'User-Agent': 'MastodonInstances (https://instances.social)'
    }
});