const config = require('./config.json');
const DB = require('monk')(config.database);

(async () => {
    let languages = {};

    for(let instance of await DB.get('instances').find({
        infos: {
            $ne: null
        },
        "uptime": {
            "$gt": 0
        },
        "blacklisted": {
            "$ne": true
        },
        "dead": {
            "$ne": true
        }
    })) {
        for (let language of instance.infos.languages) {
            if (!languages[language])
                languages[language] = 0;

            ++languages[language];
        }
    }

    let array = [];

    for(let language of Object.keys(languages)) {
        let uses = languages[language];

        array.push({
            code: language,
            uses
        });
    }

    array.sort((b, a) => {
       return a.uses - b.uses;
    });

    console.log(array.map(e => e.code + ' ' + e.uses).join('\n'));

    await DB.close();
})().catch(console.error);