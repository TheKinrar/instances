'use strict';

const Sequelize = require('sequelize');
const sequelize = require('.');

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

module.exports = Instance;