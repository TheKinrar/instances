const fs = require('fs');

global.USER_AGENT = 'MastodonInstances (https://instances.social)';

global.config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
global.DB = require('monk')(config.database, {
    connectTimeoutMS: 1000
});
global.Request = require('request').defaults({
    headers: {
        'User-Agent': USER_AGENT
    },
    timeout: 60000
});

const clearInstances = require('./tasks/clear_instances');
setInterval(clearInstances, 3600000);
clearInstances();

const updateVersions = require('./tasks/update_versions');
setInterval(updateVersions, 5 * 60 * 1000);
