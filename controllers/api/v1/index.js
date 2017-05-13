const router = require('express').Router();

router.use((req, res, next) => {
    res.sendError = (code, error) => {
        if(typeof error === 'string')
            error = {
                message: error
            };

        res.status(code).json({
            error
        });
    };

    req.url = req.url.replace(/\.json(\?|$)/i, '$1');

    let auth = req.header('Authorization');
    if(auth) {
        let arr = auth.split(" ");

        if(arr.length === 2 && arr[0] === 'Token') {
            let token = arr[1];

            DB.get('api_tokens').findOne({
                token
            }).then((token) => {
                if(token) {
                    next();
                } else {
                    res.sendError(400, "Invalid token.");
                }
            }).catch((e) => {
                console.error(e);
                res.sendStatus(500);
            });
        } else {
            res.sendError(400, "Invalid Authorization header.");
        }
    } else {
        res.sendError(400, "Missing Authorization header.");
    }
});

router.use('/instances', require('./instances'));

module.exports = router;