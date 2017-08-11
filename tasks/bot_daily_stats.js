const config = require('../config.json');
const DB = require('monk')(config.database);
const bot = require('../bot');

(async function() {
    let instances = await DB.get('instances').find({
        "upchecks": {
            "$gt": 0
        },
        "blacklisted": {
            "$ne": true
        },
        "dead": {
            "$ne": true
        }
    });

    let users = 0,
        statuses = 0,
        connections = 0;

    for(let instance of instances) {
        if(instance.users)
            users += instance.users;

        if(instance.statuses)
            statuses += instance.statuses;

        if(instance.connections)
            connections += instance.connections;
    }

    await bot.post('statuses', {
        status: `[Daily stats]

${users} users
${statuses} statuses
${connections} connections`,
        visibility: 'public'
    });

    DB.close();
})().catch((e) => {
    console.error(e);
    DB.close();
});