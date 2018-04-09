'use strict';

const Sequelize = require('sequelize');
const sequelize = require('.');
const queue = require('../queue');

const Instance = sequelize.define('instance', {
    name: {
        type: Sequelize.DataTypes.TEXT,
        allowNull: false,
        unique: true
    },

    latest_history_save: Sequelize.DataTypes.DATE,

    uptime_all: Sequelize.DataTypes.REAL,

    ipv6: Sequelize.DataTypes.BOOLEAN,

    https_score: Sequelize.DataTypes.SMALLINT,
    obs_score: Sequelize.DataTypes.SMALLINT,

    users: Sequelize.DataTypes.INTEGER,
    connections: Sequelize.DataTypes.INTEGER,
    statuses: Sequelize.DataTypes.BIGINT,

    open_registrations: Sequelize.DataTypes.BOOLEAN,

    version: Sequelize.DataTypes.TEXT,

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

Instance.prototype.queueHistorySaving = async function() {
    const job = queue.create('save_instance_history', {
        title: this.name,
        instance: this.id
    }).ttl(60000).removeOnComplete(true);

    await job.saveAsync();
};

Instance.prototype.queueAPFetch = async function() {
    const job = queue.create('fetch_instance_ap', {
        title: this.name,
        instance: this.id
    }).ttl(60000).removeOnComplete(true);

    await job.saveAsync();
};

module.exports = Instance;