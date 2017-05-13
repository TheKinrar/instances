const router = require('express').Router();
const APIUtils = require('../../../../helpers/APIUtils');

/**
 * @api {get} /instances/show Show instance information
 * @apiName ShowInstance
 * @apiGroup Instances
 *
 * @apiParam {String} name Instance name.
 *
 * @apiSuccess {String} firstname Firstname of the User.
 * @apiSuccess {String} lastname  Lastname of the User.
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "firstname": "John",
 *       "lastname": "Doe"
 *     }
 *
 * @apiError InstanceNotFound No instance with this name could be found.
 *
 * @apiErrorExample Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "error": {
 *       	"message": "Instance not found."
 *       }
 *     }
 */
router.get('/show', (req, res) => {
    let query;
    try {
        query = APIUtils.checkQuery({
            name: {
                type: 'string'
            }
        }, req.query);
    } catch(e) {
        return res.sendError(400, e.message);
    }

	DB.get('instances').findOne({
		name: query.name
	}).then((instance) => {
        if(!instance)
            return res.sendError(404, 'Instance not found.');

		res.json(APIUtils.createInstanceJson(instance));
	}).catch((err) => {
		console.error(err);
		res.sendStatus(500);
	});
});

router.get('/list', (req, res) => {
    let query;
    try {
        query = APIUtils.checkQuery({
            count: {
                type: 'int',
                min: 1,
				max: 100,
				optional: true,
				def: 20
            }, page: {
                type: 'int',
                min: 0,
                optional: true,
                def: 0
            }, include_dead: {
                type: 'boolean',
                optional: true,
                def: false
            }
        }, req.query);
    } catch(e) {
        return res.sendError(400, e.message);
    }

    let q = {
    	upchecks: {
    		$gt: 0
		},
        blacklisted: {
            $ne: true
        }
    };

    if(!query.include_dead)
    	q.dead = {
            $ne: true
        };

    Promise.all([DB.get('instances').count(q), DB.get('instances').find(q, {
        limit: query.count,
        skip: query.page * query.count
    })]).then(values => {
    	let total = values[0];
    	let instances = values[1];

        let jsons = [];

        instances.forEach((instance) => {
            jsons.push(APIUtils.createInstanceJson(instance));
        });

        res.json({
            instances: jsons,
			pagination: {
            	total,
				max_page: Math.ceil(total / query.count) - 1
			}
        });
	}).catch((err) => {
        console.error(err);
        res.sendStatus(500);
    });
});

module.exports = router;