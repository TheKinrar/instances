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
	}
 ]
});

const DB = require('monk')('localhost/mastodon-instances');
const db_instances = DB.get('instances');
const db_history = DB.get('history');

db_instances.findOne({
	"upchecks": {
		"$gt": 0
	},
	"blacklisted": {
		"$ne": true
	},
	"historyMigrated": {
		"$ne": true
	}
}).then((instance) => {
	const clearPoints = points => {
		for(let key of Object.keys(points)) {
			if(typeof points[key] === 'undefined' || points[key] === null || Number.isNaN(points[key]))
				delete points[key];
		}

		return points;
	};

	console.log('Processing ' + instance.name);

	db_history.find({"name":instance.name,"date":{"$lt":new Date(1493647177000)}}).then(records => {
		const pointsToWrite = [];

		records.forEach(record => {
			pointsToWrite.push({
			    measurement: 'instance_stats',
			    tags: { instance: instance.name },
			    fields: clearPoints({
				    uptime: record.upchecks / (record.upchecks + record.downchecks),
				    https_score: record.https_score,
				    obs_score: record.obs_score,
				    ipv6: record.ipv6,
				    openRegistrations: record.openRegistrations,
				    users: record.users,
				    statuses: record.statuses,
				    connections: record.connections
			    }),
			    timestamp: record.date
			  });
		});

		console.log('Writing ' + pointsToWrite.length + ' points');

		influx.writePoints(pointsToWrite).then(() => {
			console.log('Done.');

			db_instances.update({
				name: instance.name
			}, {
				$set: {
					historyMigrated: true
				}
			}).then(() => {
				DB.close();
			}).catch(console.error);
		}).catch(e => {
			console.error('Error while writing instance_stats to InfluxDB.', e);
		});
	});
}).catch((e) => {
	console.error(e);
});