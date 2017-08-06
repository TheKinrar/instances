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
		});
	}).catch((e) => {
		console.error(e);
	});
};