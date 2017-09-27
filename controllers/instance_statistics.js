const router = require('express-promise-router')();
const APIUtils = require('../helpers/APIUtils');
const pg = require('../pg');
const morgan = require('../middlewares/morgan');

router.use(morgan.api);

router.use((req, res, next) => {
    res.sendError = (code, error) => {
        if (typeof error === 'string')
            error = {
                message: error
            };

        res.status(code).json({
            error
        });
    };

    next();
});

router.get('/status', async (req, res) => {
    let query;
    try {
        query = APIUtils.checkQuery({
            token: {
                type: 'string'
            }
        }, req.query);
    } catch(e) {
        return res.sendError(400, e.message);
    }

    let pgc = await pg.connect();

    let instance_res = await pgc.query('SELECT * FROM instances WHERE stats_token=$1', [
        query.token
    ]);

    if(instance_res.rows.length === 0)
        return res.sendError(403, 'Invalid token.');

    let instance = instance_res.rows[0];

    let statistics_res = await pgc.query(
        'SELECT * FROM instances_statistics' +
        'WHERE instance=$1' +
        'ORDER BY timestamp DESC' +
        'LIMIT 1', [
            instance.id
    ]);
    
    let json = {
        data_needed: {
            creation_date: !instance.created_at,
            active_users: statistics_res.rows.length === 0 ||
                    statistics_res.rows[0].timestamp.getTime() <= new Date().getTime() - 3600000
        }
    };

    res.json(json);
});

module.exports = router;