const router = require('express').Router();

router.get('/', (req, res) => {
	DB.get('instances').find({
		"upchecks": {
			"$gt": 0
		},
		"blacklisted": {
			"$ne": true
		}
	}).then((instances) => {
		instances.forEach((instance) => {
			instance.uptime = (100 * (instance.upchecks / (instance.upchecks + instance.downchecks)));
			instance.uptime_str = instance.uptime.toFixed(3);

			instance.score = instance.uptime * Math.min(1, instance.upchecks / 1440);

			if(instance.up)
				instance.score += 5;

			if(instance.https_score)
				instance.score += instance.https_score / 5;

			if(instance.ipv6)
				instance.score += 5;

			if(!instance.openRegistrations)
				instance.score -= 1000;
		});

		instances.sort((b, a) => {
			return a.score - b.score;
		});

		res.render('index', {
			instances
		});
	});
});

router.get('/instances.json', (req, res) => {
	DB.get('instances').find({
		"upchecks": {
			"$gt": 0
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

			jsons.push(json);
		});

		res.json(jsons);
	});
});

router.post('/add', (req, res) => {
	if(typeof req.body.name !== 'string')
		return res.sendStatus(400);

	DB.get('instances').insert({
		name: req.body.name.toLowerCase(),
		downchecks: 0,
		upchecks: 0
	}).catch((e) => {});

	res.redirect('/');
});

module.exports = router;
