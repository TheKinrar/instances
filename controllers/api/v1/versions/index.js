const router = require('express').Router();
const APIUtils = require('../../../../helpers/APIUtils');

/**
 * @api {get} /versions/show Show version information
 * @apiName ShowVersion
 * @apiGroup Versions
 * @apiVersion 1.0.0
 *
 * @apiParam {String} name Version name.
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

    DB.get('versions').findOne({
        name: query.name
    }).then((version) => {
        if(!version)
            return res.sendError(404, 'Version not found.');

        res.json(APIUtils.createVersionJson(version));
    }).catch((err) => {
        console.error(err);
        res.sendStatus(500);
    });
});


/**
 * @api {get} /versions/list List versions
 * @apiName ListVersions
 * @apiGroup Versions
 * @apiVersion 1.0.0
 *
 * @apiParam {Number} [count=20] Number of versions to get. **0 returns all versions**.
 * @apiParam {Boolean} [include_specials=true] Include special versions which do not match any Mastodon release (e.g. Unknown and <1.3)
 * @apiParam {Boolean} [include_unused=true] Include versions which are not used by any instance
 * @apiParam {Number} [min_id] Minimal ID of versions to retrieve. Use this to navigate through pages. The id of the first version from next page is accessible through pagination.next_id.
 */
router.get('/list', (req, res) => {
    let query;
    try {
        query = APIUtils.checkQuery({
            count: {
                type: 'int',
                min: 0,
                optional: true,
                def: 20
            }, min_id: {
                type: 'int',
                optional: true
            }, include_specials: {
                type: 'boolean',
                optional: true,
                def: true
            }, include_unused: {
                type: 'boolean',
                optional: true,
                def: true
            }
        }, req.query);
    } catch(e) {
        return res.sendError(400, e.message);
    }

    let q = {};

    if(!query.include_specials) {
        q._id = {
            $gt: 0
        };
    }

    if(!query.include_unused) {
        q.instances = {
            $gt: 0
        };
    }

    if(query.min_id)
        try {
            q._id = {
                $gte: query.min_id
            };
        } catch(e) {}

    let limited = query.count > 0;
    Promise.all([DB.get('versions').count(q), DB.get('versions').find(q, limited ? {
        limit: query.count + 1
    } : undefined)]).then(values => {
    	let total = values[0];
    	let versions = values[1];

        let jsons = [];

        versions.slice(0, limited ? query.count : undefined).forEach((version) => {
            jsons.push(APIUtils.createVersionJson(version));
        });

        let res_json = {
            versions: jsons,
            pagination: {
                total
            }
        };

        if(limited && versions.length > query.count)
            res_json.pagination.next_id = versions[query.count]._id;

        res.json(res_json);
	}).catch((err) => {
        console.error(err);
        res.sendStatus(500);
    });
});

module.exports = router;