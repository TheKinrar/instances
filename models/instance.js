'use strict';

const Sequelize = require('sequelize');
const sequelize = require('.');
const queue = require('../queue');
const request = require('../helpers/request');
const got = require('../helpers/got');
const Software = require('./software');
const InstancesLog = require('../helpers/InstancesLog');
const Downtime = require('./downtime');

const config = require('../config');
const DB = require('monk')(config.database, {
    connectTimeoutMS: 3000
});

const Instance = sequelize.define('instance', {
    name: {
        type: Sequelize.DataTypes.TEXT,
        allowNull: false,
        unique: true
    },

    title: Sequelize.DataTypes.TEXT,
    description: Sequelize.DataTypes.TEXT,
    short_description: Sequelize.DataTypes.TEXT,
    advertised_uri: Sequelize.DataTypes.TEXT,

    latest_history_save: Sequelize.DataTypes.DATE,
    latest_check: Sequelize.DataTypes.DATE,
    latest_https_check: Sequelize.DataTypes.DATE,
    latest_obs_check: Sequelize.DataTypes.DATE,
    latest_ap_check: Sequelize.DataTypes.DATE,

    up: Sequelize.DataTypes.BOOLEAN,
    uptime_all: Sequelize.DataTypes.REAL,

    blacklisted: Sequelize.DataTypes.BOOLEAN,
    dead: Sequelize.DataTypes.BOOLEAN,
    dead_since: Sequelize.DataTypes.DATE,

    first_uptime: Sequelize.DataTypes.DATE,

    ipv6: Sequelize.DataTypes.BOOLEAN,

    https_score: Sequelize.DataTypes.SMALLINT,
    https_rank: Sequelize.DataTypes.CHAR(2),
    obs_score: Sequelize.DataTypes.SMALLINT,
    obs_rank: Sequelize.DataTypes.CHAR(2),

    users: Sequelize.DataTypes.INTEGER,
    connections: Sequelize.DataTypes.INTEGER,
    statuses: Sequelize.DataTypes.BIGINT,
    active_users_month: Sequelize.DataTypes.INTEGER,

    thumbnail: Sequelize.DataTypes.TEXT,

    open_registrations: Sequelize.DataTypes.BOOLEAN,

    email: Sequelize.DataTypes.TEXT,
    admin: Sequelize.DataTypes.TEXT,

    software: {
        type: Sequelize.DataTypes.INTEGER,

        references: {
            model: 'Software',
            key: 'id'
        }
    },
    version: Sequelize.DataTypes.TEXT,
    raw_version :Sequelize.DataTypes.TEXT,

    active_users_30d: Sequelize.DataTypes.INTEGER,
    active_users_14d: Sequelize.DataTypes.INTEGER,
    active_users_7d: Sequelize.DataTypes.INTEGER,
    active_users_1d: Sequelize.DataTypes.INTEGER,
    active_users_1h: Sequelize.DataTypes.INTEGER,

    first_user_created_at: Sequelize.DataTypes.DATE
}, {
    createdAt: 'created_at',
    updatedAt: false
});

Instance.addHook('beforeSave', async (instance) => {
    if (instance.up && !instance.first_uptime)
            instance.first_uptime = new Date();

    if(instance.changed('up') && instance.up) {
        let downtime = await Downtime.findOne({
            where: {
                instance: instance.id,
                end: null
            },
        });

        if (downtime) {
            downtime.end = new Date();
            await downtime.save();
        }

        // If instance was dead and just became up, it - obviously - isn't dead anymore
        instance.dead = false;
    } else if(!instance.up && !instance.dead) { // Instance is still down, maybe it is dead (2 weeks downtime)
        let downtime = await Downtime.findOne({
            where: {
                instance: instance.id,
                end: null
            },
        });

        if(!downtime) {
            downtime = await Downtime.create({
                instance: instance.id
            });
        }

        let twoWeeksBefore = new Date();
        twoWeeksBefore.setDate(-14);

        if(downtime.start < twoWeeksBefore) {
            // Instance is dead (won't be checked regularly anymore, won't appear in lists, etc.)
            instance.dead = true;
            instance.dead_since = new Date();
        }
    }

    await instance.calculateUptime();
});

Instance.addHook('afterSave', async (instance) => {
    let version = '<1.3';
    let version_score = 0;
    let raw_version = null;

    if(instance.raw_version)
        version = raw_version = instance.raw_version.replace(/\.$/, '');

    let version_notag = version.replace(/\+[0-9A-Za-z\.-]*/, '');
    let version_norc = version_notag.replace(/\.?rc[0-9]/, '');

    if(version === 'Mastodon::Version') {
        version = '1.3';
        version_score = 130;
    } else if(/^[0-9]\.[0-9](\.[0-9])?$/.test(version_norc)) {
        let version_a = version_norc.split('.').map((e) => {return parseInt(e);});

        version_score = (100 * version_a[0]) + (10 * version_a[1]) + (version_a.length === 3 ? version_a[2] : 0);
    } else {
        version = "";
    }

    let instance_mongo = await DB.get('instances').findOne({
        name: instance.name
    });

    let mongo_infos;
    if(!instance_mongo) {
        await DB.get('instances').insert({
            addedAt: new Date(),
            name: instance.name,
            downchecks: 0,
            upchecks: 0
        }).catch(() => {});

        mongo_infos = {
            shortDescription: '',
            fullDescription: '',
            theme: '',
            categories: [],
            languages: [],
            noOtherLanguages: false,
            prohibitedContent: [],
            otherProhibitedContent: [],
            federation: 'all',
            bots: 'yes',
            brands: 'yes',
            optOut: false
        };
    } else {
        mongo_infos = instance_mongo.infos || {};
    }

    mongo_infos.fullDescription = instance.description || '';
    mongo_infos.shortDescription = instance.short_description || '';
    mongo_infos.theme = instance.title || '';

    await DB.get('instances').update({
        name: instance.name
    }, {
        $set: {
            up: instance.up,
            ipv6: instance.ipv6,
            users: instance.users,
            connections: instance.connections,
            statuses: instance.statuses,
            uptime: instance.uptime_all,

            https_score: instance.https_score,
            https_rank: instance.https_rank,
            obs_score: instance.obs_score,
            obs_rank: instance.obs_rank,

            obs_date: instance.latest_obs_check,

            openRegistrations: instance.open_registrations,

            dead: instance.dead,
            blacklisted: instance.blacklisted,

            updatedAt: instance.latest_check,
            checkedAt: instance.latest_check,
            apUpdatedAt: instance.latest_ap_check,

            version,
            version_score,
            raw_version,

            email: instance.email,
            admin: instance.admin,

            thumbnail: instance.thumbnail,

            mastodon: instance.software === 1,

            infos: mongo_infos,
        }
    });
});

Instance.prototype.calculateUptime = async function() {
    if(!this.first_uptime)
        return;

    let downtimes_sum = await sequelize.query(`SELECT extract(epoch from sum(
                CASE WHEN "end" IS NULL THEN now() ELSE "end" END
                - greatest("start", now() - interval '3 month'))) AS total_downtime
            FROM downtimes 
            WHERE instance=${this.id}
            AND ("end" is null or "end" > now() - interval '3 month')`, {
        type: sequelize.QueryTypes.SELECT
    });

    let firstUptime = this.first_uptime;
    let threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    if(firstUptime < threeMonthsAgo)
        firstUptime = threeMonthsAgo;

    this.uptime_all = 1 - ((downtimes_sum[0].total_downtime * 1000) / (new Date() - firstUptime));
};

/**
 * Tries to guess the software running the instance by doing some HTTP requests.
 * Only Mastodon and Pleroma are supported.
 * @returns {Promise<?Software>} The corresponding Software object, if recognition succeeded.
 */
Instance.prototype.guessSoftware = async function() {
    let res_api_mastodon;
    try {
        res_api_mastodon = await this.getMastodonInstanceInfo();
    } catch(e) {
        return null;
    }

    if(!res_api_mastodon)
        return null;

    if(/(^| \(compatible; )Pleroma /.test(res_api_mastodon.version))
        return await Software.findByPk(2);

    return await Software.findByPk(1);
};

Instance.prototype.requestMastodonInstanceInfo = function () {
    return got({
        url: `https://mastodon.xyz/api/v1/instance`,
        responseType: 'json'
    });
}

/**
 * Fetches and returns data from the /api/v1/instance endpoint of the Mastodon API.
 * Pleroma implements this endpoint too.
 * @returns {Promise<Object>} Instance info fetched from the API
 */
Instance.prototype.getMastodonInstanceInfo = function() {
    return request({
        url: `https://${this.name}/api/v1/instance`,
        json: true,
        followRedirect: false
    });
};

/**
 * Fetches and returns data from the /api/v2/instance endpoint of the Mastodon API.
 * Pleroma does not implement this endpoint.
 * @returns {Promise<Object>} Instance info fetched from the API
 */
Instance.prototype.getMastodonInstanceInfoV2 = function() {
    return request({
        url: `https://${this.name}/api/v2/instance`,
        json: true,
        followRedirect: false
    });
};

Instance.prototype.getMastodonInstanceExtendedDescription = function() {
    return request({
        url: `https://${this.name}/api/v1/instance/extended_description`,
        json: true,
        followRedirect: false
    });
};

Instance.prototype.getStatusNetInstanceConfig = function() {
    return request({
        url: `https://${this.name}/api/statusnet/config.json`,
        json: true,
        followRedirect: false
    });
};

Instance.prototype.queueHistorySaving = function() {
    return this.queueJob('save_instance_history');
};

Instance.prototype.queueAPFetch = function() {
    return this.queueJob('fetch_instance_ap');
};

Instance.prototype.queueHttpsCheck = function() {
    return this.queueJob('check_instance_https');
};

Instance.prototype.queueObsCheck = function() {
    return this.queueJob('check_instance_obs');
};

Instance.prototype.queueCheck = function() {
    return this.queueJob('check_instance');
};

Instance.prototype.queueJob = function(job_name) {
    const job = queue.create(job_name, {
        title: this.name,
        instance: this.id
    }).ttl(10 * 60 * 1000).removeOnComplete(true);

    return job.saveAsync();
};

Instance.prototype.logError = function(content) {
    return InstancesLog.error(this.id, content);
};

Instance.prototype.logWarning = function(content) {
    return InstancesLog.warning(this.id, content);
};

module.exports = Instance;
