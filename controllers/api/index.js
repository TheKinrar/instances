const router = require('express').Router();
const crypto = require('crypto');
const randomstring = require('randomstring');

router.use((req, res, next) => {
	if(req.method === 'GET')
		res.set('Access-Control-Allow-Origin', '*');
	
	next();
});

router.use('/1.0', require('./v1'));

router.use('/instances', require('./instances'));

router.get('/token', (req, res) => {
    res.render('api/token');
});

router.post('/token', (req, res) => {
	if(!req.body.name || !req.body.email)
		return res.render('api/token');

    const hash = crypto.createHash('md5');
    hash.update(req.ip);

	(async function () {
		let appId;

		do {
			appId = Math.floor(Math.random() * 1000000000);
		} while(await DB.get('api_tokens').count({_id: appId}) > 0);

		return await DB.get('api_tokens').insert({
			_id: appId,
			name: req.body.name,
			secret: randomstring.generate(128),
			creator_ip: hash.digest('hex')
		});
	})().then((token) => {
		console.log(token);
	}).catch((e) => {
		console.error(e);
		res.sendStatus(500);
	});
});

module.exports = router;