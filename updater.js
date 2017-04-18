global.DB = require('monk')('localhost/mastodon-instances');

const checkInstances = require('./tasks/check_instances');
checkInstances();
setInterval(checkInstances, 1000);

const clearInstances = require('./tasks/clear_instances');
clearInstances();
setInterval(clearInstances, 3600000);

const saveHistory = require('./tasks/save_history');
saveHistory();
setInterval(saveHistory, 5 * 60 * 1000);
