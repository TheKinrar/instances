const pg = require('../pg');
const config = require('../config.json');
const DB = require('monk')(config.database);
const gini = require('gini');

(async function() {
    let instances = await DB.get('instances').find({
        dead: {
            $ne: true
        }, blacklisted: {
            $ne: true
        }, upchecks: {
            $gt: 0
        }, users: {
            $type: 'int'
        }, statuses: {
            $type: 'int'
        }
    });

    console.log(gini.ordered(instances.filter(instance => instance.users >= 3 && instance.users <= 100000).map(instance => instance.statuses).sort((a,  b) => a - b)));
})().then(() => {
    pg.end();
    DB.close();
}).catch((err) => {
    console.error(err);
    pg.end();
    DB.close();
});