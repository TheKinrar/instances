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
		instances.forEach((instance) => {
			delete instance._id;
			instance.date = new Date();
			db_history.insert(instance);
		});
	}).catch((e) => {
		console.error(e);
	});
};