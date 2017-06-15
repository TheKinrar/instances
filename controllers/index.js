const router = require('express').Router();
const CountryLanguages = require('country-language');
const alParser = require('accept-language-parser');

router.use('/api', require('./api'));
router.use('/admin', (req, res, next) => {
	if(req.session.user) {
		DB.get('admins').findOne({
			_id: req.session.user
		}).then((admin) => {
			req.user = res.locals.user = admin;
			next();
		}).catch((e) => {
			res.sendStatus(500);
		});
	} else {
		next();
	}
}, require('./admin'));

router.get('/', (req, res) => {
    res.render('index', {
    	acceptsLanguage: alParser.pick(req.app.locals.langCodes, req.get('Accept-Language'))
	});
});

router.post('/wizard', (req, res) => {
	req.flash('wizard', req.body);
	res.status(204).send();
});

router.get('/wizard.json', (req, res) => {
    let data = req.flash('wizard')[0];
    if(data) {
        console.log(data);

        let q = {
            "upchecks": {
                "$gt": 1440
            },
            "blacklisted": {
                "$ne": true
            },
            "dead": {
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
            "infos": {
                "$exists": true
            }
        };

        DB.get('instances').find(q).then((instances) => {
            instances.forEach((instance) => {
                let score = 0;

                // desired languages
                if (Array.isArray(data.languages)) {
                    data.languages.forEach((language) => {
                        if (instance.infos.languages.includes(language)) {
                            score += 10;
                        }
                    });
                }

                // desired instance size
                if (Number.isInteger(data.user_count)) {
                    if (instance.users < data.user_count) {
                        score += 10;
                    }
                }

                // desired moderation
                if (Array.isArray(data.moderation)) {
                    data.moderation.forEach((e) => {
                        if ((e.allowed && !instance.prohibitedContent.includes(e.id)) ||
                            (e.prohibited && instance.prohibitedContent.includes(e.id))) {
                            score += 10;
                        }
                    });
                }

                instance.sorting_score = score;

                instance.uptime = (100 * (instance.upchecks / (instance.upchecks + instance.downchecks)));
                instance.uptime_str = instance.uptime.toFixed(3);

                instance.score = 0.5 * instance.uptime * Math.min(1, instance.upchecks / 1440);

				/*if(instance.version_score)
				 instance.score += instance.version_score / 10;*/

                if (instance.https_score)
                    instance.score += instance.https_score / 5;

                if (instance.obs_score)
                    instance.score += instance.obs_score / 5;

                if (instance.ipv6)
                    instance.score += 10;
            });

            instances.sort((a, b) => b.sorting_score - a.sorting_score);

            res.json({
                query: data,
				instances,
                languages: req.app.locals.langs,
                countries: req.app.locals.countries,
                prohibitedContent: req.app.locals.ProhibitedContent
			});
        }).catch((err) => {
            console.error(err);
            res.sendStatus(500);
        });
    } else {
    	res.sendStatus(404);
	}
});

router.get('/list.json', (req, res) => {
	let q = {
		"upchecks": {
			"$gt": 0
		},
		"blacklisted": {
			"$ne": true
		},
		"dead": {
			"$ne": true
		}
	};

	DB.get('instances').find(q).then((instances) => {
		let totalUsers = 0;

		instances.forEach((instance) => {
			instance.uptime = (100 * (instance.upchecks / (instance.upchecks + instance.downchecks)));
			instance.uptime_str = instance.uptime.toFixed(3);

			instance.score = 0.5 * instance.uptime * Math.min(1, instance.upchecks / 1440);

			//if(instance.version_score)
			// instance.score += instance.version_score / 10;

			if(instance.https_score)
				instance.score += instance.https_score / 5;

			if(instance.obs_score)
				instance.score += instance.obs_score / 5;

			if(instance.ipv6)
				instance.score += 10;

			if(instance.users)
				totalUsers += instance.users;
		});

		instances.sort((b, a) => {
			return a.score - b.score;
		});

		res.json({
			instances,
			totalUsers
		});
	});
});

router.get('/list', (req, res) => {
    res.render('list');
});

router.get('/network', (req, res) => {
	DB.get('versions').find({
		instances: {
			$gt: 0
		}
	}, {sort:{
        instances: -1
    }}).then((versions) => {
		res.render('network', {versions});
	}).catch((e) => {
		res.sendStatus(500);
		console.error(e);
	});
});

router.get('/instances.json', (req, res) => {
	res.set('Access-Control-Allow-Origin', '*');
	
	DB.get('instances').find({
		"upchecks": {
			"$gt": 0
		},
		"blacklisted": {
			"$ne": true
		},
                "dead": {
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

router.get('/:instance', (req, res) => {
    DB.get('instances').findOne({
        name: req.params.instance
    }).then((instance) => {
        if(!instance)
            return res.sendStatus(404);

        influx.query(`
			select last("users"), last(statuses), last(connections)
			from instance_stats
			where instance = '${instance.name}'
			and time <= ${new Date(new Date().getTime() - (7 * 24 * 60 * 60 * 1000)).getTime()}000000`)
		.then(dbres => {
			let lastWeek = null;
			if(dbres.length > 0) {
				lastWeek = {
                    users: dbres[0].last,
                    statuses: dbres[0].last_1,
                    connections: dbres[0].last_2
				};
			}

			let score = {
				total: 0
			};

            score.total += instance.uptime * 50;
            score.total += instance.https_score / 5;
            score.total += instance.obs_score / 5;
            score.total += instance.ipv6 ? 10 : 0;

            res.render('instance', {
            	instance,
				lastWeek,
				score
            });
		}).catch(err => {
			console.error(err);
			res.sendStatus(500);
		});
    }).catch((e) => {
        console.error(e);
        res.sendStatus(500);
    });
});

module.exports = router;