const router = require('express').Router();

router.get(/^\/history(?:\.json)?$/, (req, res) => {
	if(typeof req.query.instance !== 'string' ||
		typeof req.query.start !== 'string' ||
		typeof req.query.end !== 'string' ||
		!req.query.instance ||
		isNaN(req.query.start) ||
		isNaN(req.query.end)) {
		return res.sendStatus(400);
	}

	let start, end;
	try {
		start = new Date(parseInt(req.query.start) * 1000);
		end = new Date(parseInt(req.query.end) * 1000);
	} catch(e) {
		return res.sendStatus(400);
	}

	DB.get('instances').findOne({
		name: req.query.instance,
		"uptime": {
			"$gt": 0
		},
		"blacklisted": {
			"$ne": true
		}
	}).then((instance) => {
		if(!instance) return res.sendStatus(404);

		DB.get('history').find({
			name: instance.name,
			date: {
				$gte: start,
				$lte: end
			}
		}).then((history) => {
			let jsons = [];

			history.forEach((hel) => {
				let json = {
					date: Math.floor(hel.date.getTime() / 1000),
					uptime: hel.upchecks / (hel.upchecks + hel.downchecks),
					up: hel.up,
					https: hel.https,
					ipv6: hel.ipv6,
					https_score: hel.https_score,
					https_rank: hel.https_rank,
					users: hel.users,
					statuses: hel.statuses,
					connections: hel.connections,
					openRegistrations: hel.openRegistrations
				};

				jsons.push(json);
			});

			res.json(jsons);
		}).catch((e) => {
			console.error(e);
			res.sendStatus(500);
		});
	}).catch((e) => {
		console.error(e);
		res.sendStatus(500);
	});
});

router.get(/^\/(.+?)(?:\.json)?$/, (req, res) => {
	let name = req.params['0'];

	DB.get('instances').findOne({
		name,
		"uptime": {
			"$gt": 0
		},
		"blacklisted": {
			"$ne": true
		}
	}).then((instance) => {
		let json = {
			uptime: instance.upchecks / (instance.upchecks + instance.downchecks),
			up: instance.up,
			https: instance.https,
			ipv6: instance.ipv6,
			https_score: instance.https_score,
			https_rank: instance.https_rank,
			obs_score: instance.obs_score,
			obs_rank: instance.obs_rank,
			users: instance.users,
			statuses: instance.statuses,
			connections: instance.connections,
			openRegistrations: instance.openRegistrations,
			info: instance.info
		};

		res.json(json);
	}).catch((err) => {
		console.error(err);

		res.sendStatus(500);
	});
});

module.exports = router;