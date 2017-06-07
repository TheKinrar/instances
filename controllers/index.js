const router = require('express').Router();
const CountryLanguages = require('country-language');

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

router.get('/wizard', (req, res) => {
	if(req.query.query === undefined) {
        res.render('wizard', {
            langs: CountryLanguages.getLanguages().filter((a)=>{return a.nativeName[0] !== ""}).sort((a,b)=>{return a.name[0].localeCompare(b.name[0])}),
			countries: CountryLanguages.getCountries().sort((a,b)=>{return a.name[0].localeCompare(b.name[0])})
        });
    }
    else {
        let data = JSON.parse(req.query.query);
        let query = {};

        // desired languages
        if(data.languages != undefined && data.languages.length != 0){
            query['infos.languages'] = { $in: data.languages };
        }

        // desired instance size
        if(data.user_count != undefined && data.user_count != "no_matter"){
            query.users = { $lt : data.user_count.split('_')[1]};
        }

        // desired moderation
        if(data.moderation != undefined && data.moderation.length != 0) {
            let mod = {};
            if(data.moderation.allowed != undefined && data.moderation.allowed.length != 0){
                mod.$nin = data.moderation.allowed;
            }
            if(data.moderation.prohibited != undefined && data.moderation.prohibited.length != 0){
                mod.$all = data.moderation.prohibited;
            }
            if(mod.length > 0)
            	query['infos.prohibitedContent'] = mod;
        }

        // desired security
        if(data.security != undefined){
            switch (data.security){
                case "very_high":
                    query.obs_score = { $gt: 85};
                    query.https_score = 100;
                    break;
                case "high":
                    query.obs_score = { $gt: 65};
                    query.https_score = { $gt: 80 };
                    break;
                case "medium":
                    query.obs_score = { $gt: 45};
                    query.https_score = { $gt: 60 };
            }
        }

        // desired bots or brands
        if(data.bots != undefined){
            query['infos.bots'] = data.bots;
        }
        if(data.brands != undefined){
            query['infos.brands'] = data.brands;
        }

        // desired admin location
		if(data.admin_location != undefined && data.admin_location != 0){
        	query['info.admin_location'] = data.admin_location;
		}

        // desired host location
		if(data.host_location != undefined && data.host_location != 0){
            query['info.host_location'] = data.host_location;
        }

        DB.get('instances').find(query).then((instances) => {
            // fixme code duplication with router.get('/list')
			if(instances.length != 0) {
                instances.forEach((instance) => {
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

                    // define accuracy of the result
                    let commonLang = 0;
                    if (data.languages != undefined) {
                    	if(instance.infos != undefined &&
							instance.infos.languages != undefined){

                            instance.infos.languages.forEach((lang) => {
                                if (data.languages.includes(lang))
                                    commonLang += 1;
                            });

						}
						instance.accuracy = commonLang / data.languages.length * 100;
                    }

                });

                instances.sort((b, a) => {
                    return a.accuracy - b.accuracy;
                });
            }

            res.render('instancesDisplay', {
                instances
            });
        });
	}
});

router.get('/', (req, res) => {
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

			/*if(instance.version_score)
				instance.score += instance.version_score / 10;*/

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

		res.render('list', {
			instances,
			totalUsers
		});
	});
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
