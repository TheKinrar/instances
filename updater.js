const fs = require('fs');

global.USER_AGENT = 'MastodonInstances (https://instances.social)';

global.config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
global.DB = require('monk')(config.database);
global.Request = require('request').defaults({
    headers: {
        'User-Agent': USER_AGENT
    }
});

const checkInstances = require('./tasks/check_instances');
setInterval(checkInstances, 1000);

const updateInstances = require('./tasks/update_instances');
setInterval(updateInstances, 5 * 60 * 1000);
updateInstances();

const clearInstances = require('./tasks/clear_instances');
setInterval(clearInstances, 3600000);
clearInstances();

const saveHistory = require('./tasks/save_history');
saveHistory();
setInterval(saveHistory, 5 * 60 * 1000);

const updateVersions = require('./tasks/update_versions');
setInterval(updateVersions, 5 * 60 * 1000);
