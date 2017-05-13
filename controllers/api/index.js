const router = require('express').Router();

router.use((req, res, next) => {
	if(req.method === 'GET')
		res.set('Access-Control-Allow-Origin', '*');
	
	next();
});

router.use('/1.0', require('./v1'));

router.use('/instances', require('./instances'));

module.exports = router;