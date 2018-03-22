const https = require('https');
const dns = require('dns');
const querystring = require('querystring');
const InstancesLog = require('../helpers/InstancesLog');

module.exports = () => {
	const db_instances = DB.get('instances');

	let i = 0;
	let interval = setInterval(() => {
	    if(i === 5 * 60)
	        return clearInterval(interval);

	    ++i;

        db_instances.find({second5: i, blacklisted: {$ne: true}, dead: {$ne: true}}).then((instances) => {
            instances.forEach((instance) => {
                //console.log(i + ': Checking ' + instance.name);

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
                    uri: 'https://' + instance.name + '/api/v1/instance'
                }, (err, res) => {
                    if(err) {
                        if(instance.up)
                            InstancesLog.error(instance.name, 'Instance is down: "' + err.message + '".').catch(console.error);
                        return down();
                    } else if(res.statusCode !== 200) {
                        if(instance.up)
                            InstancesLog.error(instance.name, 'Instance is down. Got status code ' + res.statusCode + '.').catch(console.error);
                        return down();
                    } else if(!instance.up) {
                        InstancesLog.info(instance.name, 'Instance is up.').catch(console.error);
                    }

                    up();
                });
            });
        });
    }, 1000);
};