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
			https_scores.push(instance.https_score);
			https_scores_sum += instance.https_score;
			obs_scores.push(instance.obs_score);
			obs_scores_sum += instance.obs_score;
			ipv6_count += (instance.ipv6 ? 1 : 0);
			openRegistrations_count += (instance.openRegistrations ? 1 : 0);
			if(!isNaN(instance.users))
				users += instance.users;
			if(!isNaN(instance.statuses))
				statuses += instance.statuses;
			if(!isNaN(instance.connections))
				connections += instance.connections;

			pointsToWrite.push({
			    measurement: 'instance_stats',
			    tags: { instance: instance.name },
			    fields: clearPoints({
				    uptime: instance.uptime,
				    https_score: instance.https_score,
				    obs_score: instance.obs_score,
				    ipv6: instance.ipv6,
				    openRegistrations: instance.openRegistrations,
				    users: instance.users,
				    statuses: instance.statuses,
				    connections: instance.connections
			    })
			  });
		});
	});

	/*date.setTime(date.getTime() + (5 * 60 * 1000));
	if(date < max_date)
		generate();*/
}

function clearPoints(points) {
	for(let key of Object.keys(points)) {
		if(typeof points[key] === 'undefined' || points[key] === null || Number.isNaN(points[key]))
			delete points[key];
	}

	return points;
};