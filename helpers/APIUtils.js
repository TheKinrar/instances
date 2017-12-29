module.exports.checkQuery = checkQuery;
module.exports.createInstanceJson = createInstanceJson;
module.exports.createVersionJson = createVersionJson;

function checkQuery(template, query) {
    let template_keys = Object.keys(template);
    let query_keys = Object.keys(query);

    for(let key of query_keys) {
        if(!template_keys.includes(key)) {
            throw new Error(`Parameter "${key}" is not accepted here.`);
        }
    }

    for(let key of template_keys) {
        let key_template = template[key];
        let key_value = query[key];

        if(!key_template.optional && !query_keys.includes(key)) {
            throw new Error(`Parameter "${key}" is missing.`);
        }

        if(!query_keys.includes(key)) {
            if(!key_template.optional)
                throw new Error(`Parameter "${key}" is missing.`);

            if(key_template.def)
                query[key] = key_template.def;

            continue;
        }

        if(key_template.values) {
            if(!key_template.values.includes(key_value))
                throw new Error(`Parameter "${key}" value "${key_value}" is not allowed.`);
        }

        if(key_template.type) {
            if(key_template.type === 'int') {
                if(/^[0-9]+$/.test(key_value)) {
                    query[key] = Number.parseInt(key_value);

                    if(key_template.min) {
                        if(query[key] < key_template.min)
                            throw new Error(`Parameter "${key}" must be greater than or equal to ${key_template.min}.`);
                    }

                    if(key_template.max) {
                        if(query[key] > key_template.max)
                            throw new Error(`Parameter "${key}" must be less than or equal to ${key_template.max}.`);
                    }
                } else {
                    throw new Error(`Parameter "${key}" is not an integer.`);
                }
            } else if(key_template.type === 'boolean') {
                if(key_value === 'true') {
                    query[key] = true;
                } else if(key_value === 'false') {
                    query[key] = false;
                } else {
                    throw new Error(`Parameter "${key}" is not a boolean.`);
                }
            }
        }
    }

    return query;
}

function createInstanceJson(instance) {
    let json = {
        id: instance._id,
        name: instance.name,
        added_at: instance.addedAt || null,
        updated_at: instance.updatedAt || null,
        checked_at: instance.checkedAt || null,
        uptime: ((instance.upchecks || 0) / ((instance.upchecks || 0) + (instance.downchecks || 0))) || null,
        up: instance.up || false,
        dead: instance.dead || false,
        version: instance.version || null,
        ipv6: instance.ipv6 || false,
        https_score: instance.https_score || null,
        https_rank: instance.https_rank || null,
        obs_score: instance.obs_score || null,
        obs_rank: instance.obs_rank || null,
        users: instance.users || 0,
        statuses: instance.statuses || 0,
        connections: instance.connections || 0,
        open_registrations: instance.openRegistrations || false,
        info: null,
        thumbnail: instance.thumbnail || null
    };

    if(instance.infos) {
        let info = instance.infos;

        json.info = {
            short_description: info.shortDescription || null,
            full_description: info.fullDescription || null,
            topic: info.theme || null,
            languages: info.languages || null,
            other_languages_accepted: !info.noOtherLanguages,
            federates_with: info.federation || null,
            prohibited_content: info.prohibitedContent || []
        };
    }

    return json;
}

function createVersionJson(version) {
    return {
        id: version._id,
        name: version.name,
        published_at: version.publishedAt || null,
        instances: version.instances || 0,
        instances_proportion: version.instances_ratio || 0,
        users: version.users || 0
    };
}