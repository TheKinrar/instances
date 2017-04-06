global.DB = require('monk')('localhost/mastodon-instances');

const checkInstances = require('./tasks/check_instances');
checkInstances();
setInterval(checkInstances, 60000);