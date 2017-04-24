const router = require('express').Router();
const auth = require('http-auth');
const passwordHash = require('password-hash');

router.use(auth.connect(auth.basic({
		realm: "Instances list administration"
	}, (username, password, cb) => {
		cb(username === config.admin.username && passwordHash.verify(password, config.admin.password));
	}
)));

router.get('/', (req, res) => {
	res.render('admin/admin/index');
});

module.exports = router;