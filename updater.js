const fs = require('fs');

global.config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
global.DB = require('monk')(config.database, {
    connectTimeoutMS: 3000
});

const clearInstances = require('./tasks/clear_instances');
setInterval(clearInstances, 3600000);
clearInstances();

const updateVersions = require('./tasks/update_versions');
setInterval(updateVersions, 5 * 60 * 1000);
