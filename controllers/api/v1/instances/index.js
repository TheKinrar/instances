const router = require('express').Router();
const APIUtils = require('../../../../helpers/APIUtils');

// https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript/3561711#3561711
RegExp.escape = function(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

/**
 * @api {get} /instances/show Show instance information
 * @apiName ShowInstance
 * @apiGroup Instances
 * @apiVersion 1.0.0
 *
 * @apiParam {String} name Instance name.
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

/**
 * @api {get} /instances/list List instances
 * @apiName ListInstances
 * @apiGroup Instances
 * @apiVersion 1.0.0
 *
 * @apiParam {Number{0-10000}} [count=20] Number of instances to get. **0 returns all instances**.
 *
 * @apiParam {Boolean} [include_dead=false] Include dead (down for at least two weeks) instances
 * @apiParam {Boolean} [include_down=true] Include down instances
 * @apiParam {Boolean} [include_closed=true] Include instances with closed registrations
 *
 * @apiParam {String="mstdn_custom_emojis"} [supported_features] Comma-separated list of features returned instances have to support
 * @apiParam {String} [min_version] Minimal Mastodon version returned instances must be running. Format must be "a.b.c" (".b" and ".c" can be omitted) with a, b, c being integers.
 *
 * @apiParam {Number{0-}} [min_active_users] Minimal active users per week returned instances must have. **This will filter out instances running Mastodon versions older than 2.1.2.**
 *
 * @apiParam {String} [category] Category instances must be in to be returned. Value *general* will return instances in no category.
 * @apiParam {String} [language] Language instances must have as main language to be returned.
 *
 * @apiParam {String} [min_id] Minimal ID of instances to retrieve. Use this to navigate through pages. The id of the first instance from next page is accessible through pagination.next_id.
 *
 * @apiParam {String="name","uptime","https_score","obs_score","users","statuses","connections","active_users"} [sort_by] Field to sort instances by. By default, instances are not sorted and their order is not guaranteed to be consistent.
 * @apiParam {String="asc","desc"} [sort_order="asc"] Sort order, if *sort_by* is used.
 */
router.get('/list', (req, res) => {
    let query;

    try {
        query = APIUtils.checkQuery({
            count: {
                type: 'int',
                min: 0,
                max: 10000,
                optional: true,
                def: 20
            }, min_id: {
                type: 'string',
                optional: true
            }, include_dead: {
                type: 'boolean',
                optional: true,
                def: false
            }, include_down: {
                type: 'boolean',
                optional: true,
                def: true
            }, include_closed: {
                type: 'boolean',
                optional: true,
                def: true
            }, supported_features: {
                type: 'string',
                optional: true,
                values: [
                    'mstdn_custom_emojis'
                ]
            }, min_version: {
                type: 'string',
                optional: true,
                regex: /^(?:[0-9]+\.){0,2}[0-9]+$/
            }, min_active_users: {
                type: 'int',
                min: 0,
                optional: true
            }, category: {
                type: 'string',
                optional: true
            }, language: {
                type: 'language',
                optional: true,
                values: Languages.getAllLanguageCode()
            }, sort_by: {
                type: 'string',
                optional: true,
                values: [
                    'name',
                    'uptime',
                    'https_score',
                    'obs_score',
                    'users',
                    'statuses',
                    'connections',
                    'active_users'
                ]
            }, sort_order: {
                type: 'string',
                optional: true,
                def: 'asc',
                values: [
                    'asc',
                    'desc'
                ]
            }
        }, req.query);
    } catch(e) {
        return res.sendError(400, e.message);
    }

    let q = {
        uptime: {
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

    if(!query.include_down)
        q.up = {
            $ne: false
        };

    if(!query.include_closed)
        q.openRegistrations = {
            $ne: false
        };

    if(query.supported_features === 'mstdn_custom_emojis')
        q.version_score = {
            $gte: 200
        };

    if(query.min_version) {
        let min_version_a = query.min_version.split('.').map((e) => {return parseInt(e);});

        q.version_score = {
            $gte: (100 * min_version_a[0]) + (min_version_a.length > 2 ? 10 * min_version_a[1] : 0) + (min_version_a.length > 2 ? min_version_a[2] : 0)
        };
    }

    if(query.min_active_users) {
        q['activity_prevw.logins'] = {
            $gte: query.min_active_users
        };
    }

    if(query.category) {
        if(query.category === 'general') {
            q['infos.categories'] = {
                $in: [[], null]
            };
        } else {
            q['infos.categories'] = query.category;
        }
    }

    if(query.language) {
        q['infos.languages'] = query.language;
    }

    if(query.min_id)
        try {
            q._id = {
                $gte: require('monk').id(query.min_id)
            };
        } catch(e) {}


    let limited = query.count > 0;

    let q_options = {};

    if(limited)
        q_options.limit = query.count + 1;

    if(query.sort_by) {
        if(query.sort_by === 'active_users')
            query.sort_by = 'activity_prevw.logins';

        q_options.sort = {};
        q_options.sort[query.sort_by] = query.sort_order === 'asc' ? 1 : -1;
    }

    Promise
    .all([DB.get('instances').count(q), DB.get('instances').find(q, q_options)])
    .then(values => {
        let total = values[0];
        let instances = values[1];

        let jsons = [];

        instances.slice(0, limited ? query.count : undefined).forEach((instance) => {
            jsons.push(APIUtils.createInstanceJson(instance));
        });

        let res_json = {
            instances: jsons,
            pagination: {
                total
            }
        };

        if(limited && instances.length > query.count)
            res_json.pagination.next_id = instances[query.count]._id;

        res.json(res_json);
    }).catch((err) => {
        console.error(err);
        res.sendStatus(500);
    });
});

/**
 * @api {get} /instances/sample Get an instances sample (random pick)
 * @apiName GetInstancesSample
 * @apiGroup Instances
 * @apiVersion 1.0.0
 *
 * @apiParam {Number{1-100}} [count=20] Number of instances to get.
 * @apiParam {Boolean} [include_dead=false] Include dead (down for at least two weeks) instances
 */
router.get('/sample', (req, res) => {
    let query;
    try {
        query = APIUtils.checkQuery({
            count: {
                type: 'int',
                min: 1,
                max: 100,
                optional: true,
                def: 20
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
        uptime: {
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

    DB.get('instances').aggregate([
        { $match : q },
        { $sample: { size: query.count } }
    ]).then(instances => {
        let jsons = [];

        instances.forEach((instance) => {
            jsons.push(APIUtils.createInstanceJson(instance));
        });

        let res_json = {
            instances: jsons
        };

        res.json(res_json);
    }).catch((err) => {
        console.error(err);
        res.sendStatus(500);
    });
});

/**
 * @api {get} /instances/search Search instances
 * @apiName SearchInstances
 * @apiGroup Instances
 * @apiVersion 1.0.0
 *
 * @apiParam {Number{0-10000}} [count=20] Number of instances to get. **0 returns all instances**.
 * @apiParam {String} q Query for searching through instance names, topics and descriptions.
 * @apiParam {Boolean} [name=false] Only search through names
 */
router.get('/search', (req, res) => {
    let query;
    try {
        query = APIUtils.checkQuery({
            count: {
                type: 'int',
                min: 0,
                max: 10000,
                optional: true,
                def: 20
            }, q: {
                type: 'string'
            }, name: {
                type: 'boolean',
                optional: true,
                def: false
            }
        }, req.query);
    } catch(e) {
        return res.sendError(400, e.message);
    }

    let or = [{
        name: {
            $regex: RegExp.escape(query.q),
            $options: 'i'
        }
    }];

    if(!query.name) {
        or.push({
            'infos.theme': {
                $regex: RegExp.escape(query.q),
                $options: 'i'
            }
        }, {
            'infos.shortDescription': {
                $regex: RegExp.escape(query.q),
                $options: 'i'
            }
        }, {
            'infos.fullDescription': {
                $regex: RegExp.escape(query.q),
                $options: 'i'
            }
        });
    }

    let q = {
        uptime: {
            $gt: 0
        },
        blacklisted: {
            $ne: true
        },
        dead: {
            $ne: true
        },
        $or: or
    };

    let limited = query.count > 0;
    Promise.all([DB.get('instances').count(q), DB.get('instances').find(q, limited ? {
        limit: query.count + 1
    } : undefined)]).then(values => {
        let total = values[0];
        let instances = values[1];

        let jsons = [];

        instances.slice(0, limited ? query.count : undefined).forEach((instance) => {
            jsons.push(APIUtils.createInstanceJson(instance));
        });

        let res_json = {
            instances: jsons,
            pagination: {
                total
            }
        };

        if(limited && instances.length > query.count)
            res_json.pagination.next_id = instances[query.count]._id;

        res.json(res_json);
    }).catch((err) => {
        console.error(err);
        res.sendStatus(500);
    });
});

module.exports = router;