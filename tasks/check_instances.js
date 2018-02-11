const https = require('https');
const dns = require('dns');
const querystring = require('querystring');

module.exports = () => {
	const db_instances = DB.get('instances');

	for(let i = 0; i < 5 * 60; ++i) {
        db_instances.find({second5: i, blacklisted: {$ne: true}, dead: {$ne: true}}).then((instances) => {
            instances.forEach((instance) => {
                console.log(i + ': Checking ' + instance.name);

                const up = () => {
                    db_instances.update({
                        _id: instance._id
                    }, {
                        $set: {
                            up: true,
                            uptime: (instance.upchecks + 1) / (instance.upchecks + instance.downchecks + 1),
                            checkedAt: new Date()
                        }, $inc: {
                            upchecks: 1
                        }
                    });
                };

                const down = () => {
                    db_instances.update({
                        _id: instance._id
                    }, {
                        $set: {
                            up: false,
                            uptime: instance.upchecks / (instance.upchecks + instance.downchecks + 1),
                            checkedAt: new Date()
                        }, $inc: {
                            downchecks: 1
                        }
                    });
                };

                Request({
                    uri: instance.name + '/api/v1/instance'
                }, (err, res) => {
                    if (err || res.statusCode !== 200)
                        return down();

                    up();
                });
            });
        });
    }
};