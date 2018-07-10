'use strict';

const Sequelize = require('sequelize');
const sequelize = require('.');
const queue = require('../queue');
const request = require('../helpers/request');
const Software = require('./software');
const InstancesLog = require('../helpers/InstancesLog');
const Downtime = require('./downtime');

const config = require('../config');
const DB = require('monk')(config.database);

const Instance = sequelize.define('instance', {
    name: {
        type: Sequelize.DataTypes.TEXT,
        allowNull: false,
        unique: true
    },

    latest_history_save: Sequelize.DataTypes.DATE,
    latest_check: Sequelize.DataTypes.DATE,
    latest_https_check: Sequelize.DataTypes.DATE,
    latest_obs_check: Sequelize.DataTypes.DATE,
    latest_ap_check: Sequelize.DataTypes.DATE,

    up: Sequelize.DataTypes.BOOLEAN,
    dead: Sequelize.DataTypes.BOOLEAN,
    uptime_all: Sequelize.DataTypes.REAL,

    first_uptime: Sequelize.DataTypes.DATE,

    ipv6: Sequelize.DataTypes.BOOLEAN,

    https_score: Sequelize.DataTypes.SMALLINT,
    https_rank: Sequelize.DataTypes.CHAR(2),
    obs_score: Sequelize.DataTypes.SMALLINT,
    obs_rank: Sequelize.DataTypes.CHAR(2),

    users: Sequelize.DataTypes.INTEGER,
    connections: Sequelize.DataTypes.INTEGER,
    statuses: Sequelize.DataTypes.BIGINT,

    thumbnail: Sequelize.DataTypes.TEXT,

    open_registrations: Sequelize.DataTypes.BOOLEAN,

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
    updatedAt: false,
    paranoid: true
});

Instance.hook('beforeSave', async (instance) => {
    if(instance.changed('up')) {
        if (instance.up) {
            if (!instance.first_uptime) {
                instance.first_uptime = new Date();
            }

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
        } else {
            await Downtime.create({
                instance: instance.id,
                start: new Date()
            });
        }
    }

    await instance.calculateUptime();
});

Instance.hook('afterSave', async (instance) => {
    let version = '<1.3';
    let version_score = 0;
    let raw_version = null;

    if(instance.raw_version)
        version = raw_version = instance.raw_version.replace(/\.$/, '');

    let version_norc = version.replace(/\.?rc[0-9]/, '');

    if(version === 'Mastodon::Version') {
        version = '1.3';
        version_score = 130;
    } else if(/^[0-9]\.[0-9](\.[0-9])?$/.test(version_norc)) {
        let version_a = version_norc.split('.').map((e) => {return parseInt(e);});

        version_score = (100 * version_a[0]) + (10 * version_a[1]) + (version_a.length === 3 ? version_a[2] : 0);
    } else {
        version = "";
    }

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

            updatedAt: instance.latest_check,
            checkedAt: instance.latest_check,
            apUpdatedAt: instance.latest_ap_check,

            version,
            version_score,
            raw_version,

            mastodon: instance.software && instance.software.id === 1
        }
    });
});

Instance.prototype.calculateUptime = async function() {
    let downtimes_sum = await sequelize.query(`SELECT extract(epoch from sum((CASE WHEN "end" IS NULL THEN now() ELSE "end" END) - "start")) AS total_downtime
            FROM downtimes 
            WHERE instance=${this.id};`, {
        type: sequelize.QueryTypes.SELECT
    });

    this.uptime_all = 1 - ((downtimes_sum[0].total_downtime * 1000) / (new Date() - this.first_uptime));
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
        return await Software.findById(2);

    return await Software.findById(1);
};

/**
 * Fetches and returns data from the /api/v1/instance endpoint of the Mastodon API.
 * Pleroma implements this endpoint too.
 * @returns {Promise<Object>} Instance info fetched from the API
 */
Instance.prototype.getMastodonInstanceInfo = function() {
    return request({
        url: `https://${this.name}/api/v1/instance`,
        json: true
    });
};

Instance.prototype.getStatusNetInstanceConfig = function() {
    return request({
        url: `https://${this.name}/api/statusnet/config.json`,
        json: true
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
    }).ttl(60000).removeOnComplete(true);

    return job.saveAsync();
};

Instance.prototype.logError = function(content) {
    return InstancesLog.error(this.id, content);
};

Instance.prototype.logWarning = function(content) {
    return InstancesLog.warning(this.id, content);
};

module.exports = Instance;