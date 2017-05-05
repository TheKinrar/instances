const router = require('express').Router();

router.use((req, res, next) => {
	if(req.method === 'GET')
		res.set('Access-Control-Allow-Origin', '*');
	
	next();
});

router.use('/instances', require('./instances'));

module.exports = router;