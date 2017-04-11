const router = require('express').Router();

router.use('/instances', require('./instances'));

module.exports = router;