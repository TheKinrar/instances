module.exports = require('request-promise-native').defaults({
    headers: {
        'User-Agent': 'MastodonInstances (https://instances.social)'
    }
});