const router = require('express').Router();
const crypto = require('crypto');
const randomstring = require('randomstring');
const morgan = require('../../middlewares/morgan');

const allowOrigin = (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');

    if(req.method === 'OPTIONS')
        return res.status(204).send();

    next();
};

router.use('/1.0', morgan.api, allowOrigin, require('./v1'));

router.use('/instances', morgan.api, allowOrigin, require('./instances'));

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
			createdAt: new Date(),
			secret: randomstring.generate(128),
			creator_ip: hash.digest('hex'),
            name: req.body.name,
			email: req.body.email
		});
	})().then((token) => {
		res.render('api/token', {token});
	}).catch((e) => {
		console.error(e);
		res.sendStatus(500);
	});
});

module.exports = router;