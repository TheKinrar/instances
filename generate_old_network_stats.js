const Influx = require('influx');

const influx = new Influx.InfluxDB({
 host: 'localhost',
 database: 'mastodon_instances',
 schema: [
	{
	  measurement: 'instance_stats',
	  fields: {
	    uptime: Influx.FieldType.FLOAT,
	    https_score: Influx.FieldType.INTEGER,
	    obs_score: Influx.FieldType.INTEGER,
	    ipv6: Influx.FieldType.BOOLEAN,
	    openRegistrations: Influx.FieldType.BOOLEAN,
	    users: Influx.FieldType.INTEGER,
	    statuses: Influx.FieldType.INTEGER,
	    connections: Influx.FieldType.INTEGER
	  },
	  tags: [
	    'instance'
	  ]
	}, {
	  measurement: 'network_stats',
	  fields: {
	    average_uptime: Influx.FieldType.FLOAT,
	    median_uptime: Influx.FieldType.FLOAT,
	    average_https_score: Influx.FieldType.INTEGER,
	    median_https_score: Influx.FieldType.INTEGER,
	    average_obs_score: Influx.FieldType.INTEGER,
	    median_obs_score: Influx.FieldType.INTEGER,
	    ipv6_absolute: Influx.FieldType.INTEGER,
	    ipv6_relative: Influx.FieldType.FLOAT,
	    openRegistrations_absolute: Influx.FieldType.INTEGER,
	    openRegistrations_relative: Influx.FieldType.FLOAT,
	    users: Influx.FieldType.INTEGER,
	    statuses: Influx.FieldType.INTEGER,
	    connections: Influx.FieldType.INTEGER
	  },
	  tags: []
	}
 ]
});

const date = new Date(1491844817026);
const max_date = new Date(1493592264513);

let average = (arr) => {
	if(!arr || arr.length === 0)
		return undefined;

    let sum = 0,
        n = 0;

    arr.forEach(e => {
        if(typeof e === 'number' && !Number.isNaN(e)) {
            sum += e;
            n++;
        }
    });

    return sum / n;
};

let median = (arr) => {
    if(!arr || arr.length === 0)
        return undefined;

    let arr2 = [];
    arr.forEach(e => {
        if(typeof e === 'number' && !Number.isNaN(e)) {
            arr2.push(e);
        }
    });
    arr = arr2;

    arr.sort((a, b) => a - b);

    if(arr.length % 2 == 0)
        return (arr[arr.length / 2] + arr[(arr.length / 2) + 1]) / 2;

    return arr[((arr.length - 1) / 2) + 1];
};

generate();

function generate() {
	console.log('Generating network stats for ' + date);

	let prev_date = new Date(date.getTime() - (5 * 60 * 1000)); 
	influx.query(`
		SELECT * FROM instance_stats
		WHERE time <= ${date.getTime()}000000 AND time >= ${prev_date.getTime()}000000
		ORDER BY time DESC`)
	.then((rows) => {
        let uptimes = [],
            uptimes_sum = 0,
            https_scores = [],
            https_scores_sum = 0,
            obs_scores = [],
            obs_scores_sum = 0,
            ipv6_count = 0,
            openRegistrations_count = 0,
            users = 0,
            statuses = 0,
            connections = 0;

		const processedInstances = [];
		const pointsToWrite = [];

		rows.forEach((instance) => {
			if(processedInstances.includes(instance.instance))
				return;
			processedInstances.push(instance.instance);

            uptimes.push(instance.uptime);
            uptimes_sum += instance.uptime;

            if(instance.https_score) {
                https_scores.push(instance.https_score);
                https_scores_sum += instance.https_score;
            }

            if(instance.obs_score) {
                obs_scores.push(instance.obs_score);
                obs_scores_sum += instance.obs_score;
			}

            ipv6_count += (instance.ipv6 ? 1 : 0);
            openRegistrations_count += (instance.openRegistrations ? 1 : 0);
            if(!isNaN(instance.users))
                users += instance.users;
            if(!isNaN(instance.statuses))
                statuses += instance.statuses;
            if(!isNaN(instance.connections))
                connections += instance.connections;
		});

        influx.writePoints([
            {
                measurement: 'network_stats',
                fields: clearPoints({
                    average_uptime: average(uptimes),
                    median_uptime: median(uptimes),
                    average_https_score: average(https_scores),
                    median_https_score: median(https_scores),
                    average_obs_score:  average(obs_scores),
                    median_obs_score: median(obs_scores),
                    ipv6_absolute: ipv6_count,
                    ipv6_relative: ipv6_count / processedInstances.length,
                    openRegistrations_absolute: openRegistrations_count,
                    openRegistrations_relative: openRegistrations_count / processedInstances.length,
                    users,
                    statuses,
                    connections
                }),
				timestamp: date
            }
        ]).then(() => {
        	console.log('Done.');

            date.setTime(date.getTime() + (5 * 60 * 1000));
            if(date < max_date)
                generate();
		}).catch(e => {
            console.error('Error while writing network_stats to InfluxDB.', e);
        });
	});
}

function clearPoints(points) {
	for(let key of Object.keys(points)) {
		if(typeof points[key] === 'undefined' || points[key] === null || Number.isNaN(points[key]))
			delete points[key];
	}

	return points;
};