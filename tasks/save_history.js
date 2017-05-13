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
	    https_rank: Influx.FieldType.STRING,
	    obs_rank: Influx.FieldType.STRING,
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

influx.getDatabaseNames().then(names => {
	if (!names.includes('mastodon_instances')) {
	  return influx.createDatabase('mastodon_instances');
	}
}).catch(err => {
	console.error(`Error creating Influx database: ${err}`);
});

module.exports = () => {
	const db_instances = DB.get('instances');
	const db_history = DB.get('history');

	db_instances.find({
		"upchecks": {
			"$gt": 0
		},
		"blacklisted": {
			"$ne": true
		}
	}).then((instances) => {
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

		const clearPoints = points => {
			for(let key of Object.keys(points)) {
				if(typeof points[key] === 'undefined' || points[key] === null || Number.isNaN(points[key]))
					delete points[key];
			}

			return points;
		};

		const pointsToWrite = [];

		instances.forEach((instance) => {
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

			delete instance._id;
			instance.date = new Date();
			db_history.insert(instance);

			pointsToWrite.push({
			    measurement: 'instance_stats',
			    tags: { instance: instance.name },
			    fields: clearPoints({
				    uptime: instance.uptime,
				    https_score: instance.https_score,
				    obs_score: instance.obs_score,
				    https_rank: instance.https_rank,
				    obs_rank: instance.obs_rank,
				    ipv6: instance.ipv6,
				    openRegistrations: instance.openRegistrations,
				    users: instance.users,
				    statuses: instance.statuses,
				    connections: instance.connections
			    })
			  });
		});

		let average = (arr) => {
			let sum = 0,
			    n = 0;

			arr.forEach(e => {
				if(!isNaN(e) && e !== null) {
					sum += e;
					n++;
				}
			});

			return sum / n;
		};

		let median = (arr) => {
			arr.sort((a, b) => a - b);

			if(arr.length % 2 == 0)
				return (arr[arr.length / 2] + arr[(arr.length / 2) + 1]) / 2;

			return arr[((arr.length - 1) / 2) + 1];
		};

		influx.writePoints(pointsToWrite).catch(e => {
			console.error('Error while writing instance_stats to InfluxDB.', e);
		});

		/*influx.writePoints([
		  {
		    measurement: 'network_stats',
		    fields: {
			    average_uptime: average(uptimes),
			    median_uptime: median(uptimes),
			    average_https_score: average(https_scores),
			    median_https_score: median(https_scores),
			    average_obs_score:  average(obs_scores),
			    median_obs_score: median(obs_scores),
			    ipv6_absolute: ipv6_count,
			    ipv6_relative: ipv6_count / instances.length,
			    openRegistrations_absolute: openRegistrations_count,
			    openRegistrations_relative: openRegistrations_count / instances.length,
			    users,
			    statuses,
			    connections
		    }
		  }
		]).catch(e => {
			console.error('Error while writing network_stats to InfluxDB.', e);
		});*/
	}).catch((e) => {
		console.error(e);
	});
};