const router = require('express').Router();

router.use('/api', require('./api'));

router.get('/', (req, res) => {
	let q = {
		"upchecks": {
			"$gt": 1440
		},
		"blacklisted": {
			"$ne": true
		},
		"uptime": {
			$gte: 0.99
		},
		"https_score": {
			$gte: 80
		},
		"obs_score": {
			$gte: 65
		},
		"openRegistrations": true,
		"info": {
			"$type": 2
		},
		"$where": "this.info.length > 32"
	};

	DB.get('instances').find(q).then((instances) => {
		instances.forEach((instance) => {
			instance.uptime_str = (instance.uptime * 100).toFixed(3);
		});

		res.render('index', {
			instances: shuffleArray(instances).slice(0, 30)
		});
	});
});

router.get('/list', (req, res) => {
	let q = {
		"upchecks": {
			"$gt": 0
		},
		"blacklisted": {
			"$ne": true
		}
	};

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

		res.render('list', {
			instances,
			totalUsers
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

function shuffleArray(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}