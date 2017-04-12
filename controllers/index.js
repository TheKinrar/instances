const router = require('express').Router();

router.use('/api', require('./api'));

router.get(/^\/(all)?$/, (req, res) => {
	let q = {
		"upchecks": {
			"$gt": 0
		},
		"blacklisted": {
			"$ne": true
		}
	};

	let all = req.params['0'] === 'all';
	if(!all) {
		q.openRegistrations = true;
	}

	DB.get('instances').find(q).then((instances) => {
		var totalUsers = 0;

		instances.forEach((instance) => {
			instance.uptime = (100 * (instance.upchecks / (instance.upchecks + instance.downchecks)));
			instance.uptime_str = instance.uptime.toFixed(3);

			instance.score = instance.uptime * Math.min(1, instance.upchecks / 1440);

			if(instance.up)
				instance.score += 5;

			if(instance.https_score)
				instance.score += instance.https_score / 5;

			if(instance.obs_score)
				instance.score += instance.obs_score / 5;

			if(instance.ipv6)
				instance.score += 5;

			instance.score_str = '' + Math.floor(instance.score * 10);

			totalUsers += instance.users;
		});

		instances.sort((b, a) => {
			return a.score - b.score;
		});

		res.render('index', {
			instances,
			totalUsers,
			all
		});
	});
});

router.get('/instances.json', (req, res) => {
	DB.get('instances').find({
		"upchecks": {
			"$gt": 0
		},
		"blacklisted": {
			"$ne": true
		}
	}).then((instances) => {
		let jsons = [];

		instances.forEach((instance) => {
			let json = {};
			json.name = instance.name;
			json.uptime = (100 * (instance.upchecks / (instance.upchecks + instance.downchecks)));
			json.up = instance.up;
			json.https_score = instance.https_score;
			json.https_rank = instance.https_rank;
			json.ipv6 = instance.ipv6;
			json.openRegistrations = instance.openRegistrations;
			json.users = instance.users;
			json.statuses = instance.statuses;
			json.connections = instance.connections;

			jsons.push(json);
		});

		res.json(jsons);
	});
});

router.post('/add', (req, res) => {
	if(typeof req.body.name !== 'string')
		return res.sendStatus(400);

	DB.get('instances').insert({
		addedAt: new Date(),
		name: req.body.name.toLowerCase(),
		downchecks: 0,
		upchecks: 0
	}).catch((e) => {});

	res.redirect('/');
});

module.exports = router;
